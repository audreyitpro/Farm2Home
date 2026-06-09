// app/freight/dashboard.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

import { supabase } from "../data/supabaseClient";
import freightTheme from "../styles/freightTheme";

type FreightStatus =
  | "OPEN"
  | "BOOKED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "available"
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
  | "cancelled";

type FreightLoad = {
  id: string;
  title: string;
  commodity: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  rate: number;
  miles: number;
  weight?: string;
  farmerName?: string;
  status: FreightStatus;
  equipment?: string;
  pickupDate?: string;

  pickup_location?: string;
  dropoff_location?: string;
  farmer_name?: string;
  equipment_type?: string;
  weight_lbs?: number | null;
  distance_miles?: number | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  carrier_id?: string | null;
  driver_id?: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  created_at?: string | null;
};

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
  slate: "#64748B",
};

const MOCK_LOADS: FreightLoad[] = [
  {
    id: "load_1",
    title: "Fresh Produce Delivery",
    commodity: "Organic Vegetables",
    pickupCity: "Detroit",
    pickupState: "MI",
    deliveryCity: "Ann Arbor",
    deliveryState: "MI",
    rate: 425,
    miles: 48,
    weight: "2,400 lbs",
    farmerName: "Green Valley Farms",
    status: "OPEN",
    equipment: "Cargo Van",
    pickupDate: "Today · 5:30 PM",
  },
  {
    id: "load_2",
    title: "Farm Eggs Delivery",
    commodity: "Fresh Eggs",
    pickupCity: "Lansing",
    pickupState: "MI",
    deliveryCity: "Grand Rapids",
    deliveryState: "MI",
    rate: 560,
    miles: 92,
    weight: "1,900 lbs",
    farmerName: "Sunrise Acres",
    status: "BOOKED",
    equipment: "Sprinter Van",
    pickupDate: "Tomorrow · 7:00 AM",
  },
  {
    id: "load_3",
    title: "Cold Chain Food Transport",
    commodity: "Fresh Fish",
    pickupCity: "Toledo",
    pickupState: "OH",
    deliveryCity: "Detroit",
    deliveryState: "MI",
    rate: 790,
    miles: 118,
    weight: "3,100 lbs",
    farmerName: "Blue Water Fishery",
    status: "IN_TRANSIT",
    equipment: "Refrigerated Van",
    pickupDate: "In Progress",
  },
];

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function splitCityState(location?: string | null) {
  const raw = String(location || "").trim();
  const parts = raw.split(",").map((x) => x.trim());
  return {
    city: parts[0] || "TBD",
    state: parts[1] || "",
  };
}

function mapDbStatus(status: any): FreightStatus {
  const value = normalize(status);

  if (value === "available") return "OPEN";
  if (value === "accepted") return "BOOKED";
  if (value === "arrived_pickup") return "BOOKED";
  if (value === "picked_up") return "PICKED_UP";
  if (value === "in_transit") return "IN_TRANSIT";
  if (value === "arrived_dropoff") return "IN_TRANSIT";
  if (value === "delivered" || value === "completed") return "DELIVERED";

  return String(status || "OPEN").toUpperCase() as FreightStatus;
}

function toDbStatus(status: FreightStatus) {
  switch (status) {
    case "OPEN":
      return "available";
    case "BOOKED":
      return "accepted";
    case "PICKED_UP":
      return "picked_up";
    case "IN_TRANSIT":
      return "in_transit";
    case "DELIVERED":
      return "delivered";
    default:
      return normalize(status);
  }
}

function mapDbLoad(row: any): FreightLoad {
  const pickup = splitCityState(row.pickup_location);
  const dropoff = splitCityState(row.dropoff_location);

  return {
    ...row,
    id: String(row.id),
    title: row.title || row.commodity || "Freight Load",
    commodity: row.commodity || "Farm Freight",
    pickupCity: pickup.city,
    pickupState: pickup.state,
    deliveryCity: dropoff.city,
    deliveryState: dropoff.state,
    pickup_location: row.pickup_location,
    dropoff_location: row.dropoff_location,
    rate: Number(row.rate || row.freight_total || row.total_due || row.payout || 0),
    miles: Number(row.distance_miles || row.miles || 0),
    weight: row.weight_lbs ? `${Number(row.weight_lbs).toLocaleString()} lbs` : row.weight || "TBD",
    farmerName: row.farmer_name || row.farmerName || "Farm2Home Partner",
    status: mapDbStatus(row.status),
    equipment: row.equipment_type || row.equipment || "Standard",
    pickupDate:
      row.pickup_date && row.pickup_time
        ? `${row.pickup_date} · ${row.pickup_time}`
        : row.pickup_date || row.pickupDate || "TBD",
  };
}

export default function FreightDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrierName, setCarrierName] = useState("Carrier");
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  async function getStoredCarrier() {
    const saved =
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const carrierId = stored?.id || stored?.freightId || authUser?.id || "";
      const email = normalize(stored?.email || authUser?.email || "");

      let dbCarrier: any = null;

      if (carrierId) {
        const result = await supabase
          .from("freight_users")
          .select("*")
          .eq("id", carrierId)
          .maybeSingle();

        if (!result.error && result.data) dbCarrier = result.data;
      }

      if (!dbCarrier && email) {
        const result = await supabase
          .from("freight_users")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (!result.error && result.data) dbCarrier = result.data;
      }

      const mergedCarrier = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier?.id || stored?.id || stored?.freightId || authUser?.id || "",
        freightId: dbCarrier?.id || stored?.freightId || stored?.id || authUser?.id || "",
        role: "freight",
        email: normalize(dbCarrier?.email || stored?.email || email),
        companyName:
          dbCarrier?.company_name ||
          dbCarrier?.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          stored?.ownerName ||
          stored?.fullName ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier?.business_name ||
          dbCarrier?.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
        contactName:
          dbCarrier?.contact_name ||
          dbCarrier?.name ||
          stored?.contactName ||
          stored?.ownerName ||
          stored?.fullName ||
          "",
        membershipStatus:
          dbCarrier?.membership_status || stored?.membershipStatus || "Active",
        subscriptionStatus:
          dbCarrier?.subscription_status || stored?.subscriptionStatus || "active",
        accountActive: dbCarrier?.account_active ?? stored?.accountActive ?? true,
      };

      setCarrier(mergedCarrier);
      setCarrierName(mergedCarrier.companyName || "Freight Connect Carrier");

      await AsyncStorage.setItem("currentFreight", JSON.stringify(mergedCarrier));
      await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(mergedCarrier));
      await AsyncStorage.setItem("currentFreightUser", JSON.stringify(mergedCarrier));
      await AsyncStorage.setItem("currentUser", JSON.stringify(mergedCarrier));
      await AsyncStorage.setItem("userRole", "freight");
      await AsyncStorage.setItem("currentUserRole", "freight");

      await loadFreightLoads(mergedCarrier.id || mergedCarrier.freightId);
    } catch (error) {
      console.log("Freight dashboard load error:", error);
      setCarrierName("Freight Connect Carrier");
      setLoads(MOCK_LOADS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadFreightLoads(carrierId: string) {
    try {
      if (!carrierId) {
        setLoads(MOCK_LOADS);
        return;
      }

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `status.eq.available,carrier_id.eq.${carrierId},driver_id.eq.${carrierId},accepted_by.eq.${carrierId}`
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight loads error:", error.message);
        setLoads(MOCK_LOADS);
        return;
      }

      const mapped = Array.isArray(data) && data.length > 0 ? data.map(mapDbLoad) : MOCK_LOADS;
      setLoads(mapped);
    } catch (error) {
      console.log("Freight load sync skipped:", error);
      setLoads(MOCK_LOADS);
    }
  }

  async function refreshDashboard() {
    setRefreshing(true);
    await loadDashboard();
  }

  function getStatusColor(status: FreightStatus) {
    switch (mapDbStatus(status)) {
      case "OPEN":
        return COLORS.blue;
      case "BOOKED":
        return COLORS.red;
      case "PICKED_UP":
        return COLORS.amber;
      case "IN_TRANSIT":
        return COLORS.purple;
      case "DELIVERED":
        return COLORS.green;
      default:
        return COLORS.slate;
    }
  }

  function getStatusIcon(status: FreightStatus): keyof typeof Ionicons.glyphMap {
    switch (mapDbStatus(status)) {
      case "OPEN":
        return "cube-outline";
      case "BOOKED":
        return "checkmark-circle-outline";
      case "PICKED_UP":
        return "archive-outline";
      case "IN_TRANSIT":
        return "navigate-outline";
      case "DELIVERED":
        return "checkmark-done-outline";
      default:
        return "ellipse-outline";
    }
  }

  async function updateLoadStatus(load: FreightLoad, nextStatus: FreightStatus) {
    const now = new Date().toISOString();

    setLoads((prev) =>
      prev.map((item) => (item.id === load.id ? { ...item, status: nextStatus } : item))
    );

    if (!load.id.startsWith("load_")) {
      const updatePayload: any = {
        status: toDbStatus(nextStatus),
        updated_at: now,
      };

      if (nextStatus === "BOOKED") {
        updatePayload.carrier_id = carrier?.id || carrier?.freightId || null;
        updatePayload.accepted_by =
          carrier?.companyName || carrier?.businessName || carrierName || "Freight Carrier";
        updatePayload.accepted_at = now;
      }

      if (nextStatus === "PICKED_UP") {
        updatePayload.picked_up_at = now;
      }

      if (nextStatus === "DELIVERED") {
        updatePayload.delivered_at = now;
      }

      const { error } = await supabase
        .from("freight_loads")
        .update(updatePayload)
        .eq("id", load.id);

      if (error) {
        Alert.alert("Update Warning", error.message);
      }
    }
  }

  async function acceptLoad(load: FreightLoad) {
    await updateLoadStatus(load, "BOOKED");

    Alert.alert(
      "Load Accepted",
      `${load.title} has been assigned to your carrier account.`
    );
  }

  async function moveToPickedUp(load: FreightLoad) {
    await updateLoadStatus(load, "PICKED_UP");
    Alert.alert("Pickup Confirmed", `${load.title} is now marked picked up.`);
  }

  async function moveToTransit(load: FreightLoad) {
    await updateLoadStatus(load, "IN_TRANSIT");
    Alert.alert("Route Updated", `${load.title} is now in transit.`);
  }

  async function completeLoad(load: FreightLoad) {
    await updateLoadStatus(load, "DELIVERED");
    Alert.alert("Delivery Completed", `${load.title} has been completed.`);
  }

  function openLiveTracking(load: FreightLoad) {
    router.push({
      pathname: "/freight/live-route" as any,
      params: {
        loadId: load.id,
        title: load.title,
      },
    });
  }

  function openBoard() {
    router.push("/freight/board" as any);
  }

  const activeLoads = useMemo(
    () =>
      loads.filter((item) =>
        ["BOOKED", "PICKED_UP", "IN_TRANSIT"].includes(String(mapDbStatus(item.status)))
      ),
    [loads]
  );

  const openLoads = useMemo(
    () => loads.filter((item) => mapDbStatus(item.status) === "OPEN"),
    [loads]
  );

  const completedLoads = useMemo(
    () => loads.filter((item) => mapDbStatus(item.status) === "DELIVERED"),
    [loads]
  );

  const visibleRevenue = useMemo(
    () => loads.reduce((sum, item) => sum + Number(item.rate || 0), 0),
    [loads]
  );

  const activeRevenue = useMemo(
    () => activeLoads.reduce((sum, item) => sum + Number(item.rate || 0), 0),
    [activeLoads]
  );

  function renderWorkflowText(status: FreightStatus) {
    switch (mapDbStatus(status)) {
      case "OPEN":
        return "Review load details and accept if available.";
      case "BOOKED":
        return "Proceed to pickup and confirm arrival.";
      case "PICKED_UP":
        return "Start delivery route and update transit status.";
      case "IN_TRANSIT":
        return "Complete delivery and capture confirmation.";
      case "DELIVERED":
        return "Delivery completed and ready for settlement.";
      default:
        return "Follow the route workflow.";
    }
  }

  function renderAction(load: FreightLoad) {
    const status = mapDbStatus(load.status);

    if (status === "OPEN") {
      return (
        <TouchableOpacity style={styles.primaryAction} onPress={() => acceptLoad(load)}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Accept Load</Text>
        </TouchableOpacity>
      );
    }

    if (status === "BOOKED") {
      return (
        <TouchableOpacity style={styles.warningAction} onPress={() => moveToPickedUp(load)}>
          <Ionicons name="archive-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Confirm Pickup</Text>
        </TouchableOpacity>
      );
    }

    if (status === "PICKED_UP") {
      return (
        <TouchableOpacity style={styles.transitAction} onPress={() => moveToTransit(load)}>
          <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Start Transit</Text>
        </TouchableOpacity>
      );
    }

    if (status === "IN_TRANSIT") {
      return (
        <TouchableOpacity style={styles.successAction} onPress={() => completeLoad(load)}>
          <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Complete Delivery</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.completedBadge}>
        <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
        <Text style={styles.completedText}>Completed</Text>
      </View>
    );
  }

  function renderLoad({ item }: { item: FreightLoad }) {
    const status = mapDbStatus(item.status);
    const payoutPerMile = item.miles > 0 ? Number(item.rate || 0) / Number(item.miles) : 0;

    return (
      <View style={styles.loadCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.routeColumn}>
            <Text style={styles.routeText}>
              {item.pickupCity}, {item.pickupState}
            </Text>

            <View style={styles.routeMiddle}>
              <View style={styles.routeLine} />
              <Ionicons name="arrow-down" size={18} color={COLORS.red} />
              <View style={styles.routeLine} />
            </View>

            <Text style={styles.routeText}>
              {item.deliveryCity}, {item.deliveryState}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
            <Ionicons name={getStatusIcon(status)} size={14} color="#FFFFFF" />
            <Text style={styles.statusText}>{String(status).replace(/_/g, " ")}</Text>
          </View>
        </View>

        <View style={styles.workflowCard}>
          <Text style={styles.workflowLabel}>Route Workflow</Text>
          <Text style={styles.workflowText}>{renderWorkflowText(status)}</Text>
        </View>

        <Text style={styles.loadTitle}>{item.title}</Text>
        <Text style={styles.commodity}>{item.commodity}</Text>

        <View style={styles.detailGrid}>
          <DetailBox icon="calendar-outline" label="Pickup" value={item.pickupDate || "TBD"} />
          <DetailBox icon="car-outline" label="Equipment" value={item.equipment || "Standard"} />
          <DetailBox icon="scale-outline" label="Weight" value={item.weight || "TBD"} />
          <DetailBox icon="leaf-outline" label="Posted By" value={item.farmerName || "Farm2Home Partner"} />
        </View>

        <View style={styles.payoutRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.payoutLabel}>Carrier Payout</Text>
            <Text style={styles.payoutAmount}>{money(item.rate)}</Text>
            <Text style={styles.mileText}>
              {item.miles} miles · ${payoutPerMile.toFixed(2)} / mile
            </Text>
          </View>

          <View style={styles.actionStack}>
            {renderAction(item)}

            {status !== "OPEN" && (
              <TouchableOpacity style={styles.trackAction} onPress={() => openLiveTracking(item)}>
                <Ionicons name="map-outline" size={18} color={COLORS.red} />
                <Text style={styles.trackActionText}>Live Route</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight operations...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>Farm2Home Freight Connect</Text>
              <Text style={styles.heroTitle}>Freight Operations Center</Text>
              <Text style={styles.heroSubtitle}>
                Manage load opportunities, dispatch status, route workflow, payout visibility,
                and delivery completion from one carrier workspace.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="trail-sign-outline" size={34} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.carrierRibbon}>
            <Text style={styles.carrierLabel}>Carrier Account</Text>
            <Text style={styles.carrierName}>{carrierName}</Text>
            <Text style={styles.carrierSub}>
              {carrier?.email || "Freight carrier workspace"} ·{" "}
              {carrier?.membershipStatus || carrier?.subscriptionStatus || "Active"}
            </Text>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navButton} onPress={openBoard}>
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Load Board</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/freight/profile" as any)}
          >
            <Ionicons name="business-outline" size={18} color={COLORS.red} />
            <Text style={styles.navTextOutline}>Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard icon="cube-outline" label="Open Loads" value={openLoads.length} />
          <MetricCard icon="navigate-outline" label="Active Routes" value={activeLoads.length} />
          <MetricCard icon="checkmark-done-outline" label="Completed" value={completedLoads.length} />
        </View>

        <View style={styles.revenueCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.revenueLabel}>Visible Route Value</Text>
            <Text style={styles.revenueValue}>{money(visibleRevenue)}</Text>
            <Text style={styles.revenueSub}>Active value: {money(activeRevenue)}</Text>
          </View>

          <TouchableOpacity style={styles.boardButton} onPress={openBoard}>
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.boardButtonText}>Open Board</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction title="My Loads" icon="briefcase-outline" route="/freight/my-loads" />
          <QuickAction title="Live Loads" icon="pulse-outline" route="/freight/live-loads" />
          <QuickAction title="Settings" icon="settings-outline" route="/freight/settings" />
          <QuickAction title="Subscription" icon="card-outline" route="/freight/subscription" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dispatch Queue</Text>

          <TouchableOpacity style={styles.refreshButton} onPress={refreshDashboard}>
            <Ionicons name="refresh-outline" size={17} color={COLORS.red} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={loads}
          keyExtractor={(item) => item.id}
          renderItem={renderLoad}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No freight loads found.</Text>
              <Text style={styles.emptyText}>
                Open the board or refresh to check for available farm freight.
              </Text>
            </View>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ icon, label, value }: any) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DetailBox({ icon, label, value }: any) {
  return (
    <View style={styles.detailBox}>
      <Ionicons name={icon} size={17} color={COLORS.red} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function QuickAction({ title, icon, route }: any) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={23} color={COLORS.red} />
      <Text style={styles.quickCardText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: {
    color: COLORS.muted,
    marginTop: 12,
    fontWeight: "800",
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 28,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  heroEyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 10,
  },
  heroSubtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
    fontWeight: "700",
  },
  carrierRibbon: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  carrierLabel: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  carrierName: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 4,
  },
  carrierSub: {
    color: "#D1D5DB",
    fontWeight: "700",
    marginTop: 4,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
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
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.black,
    marginTop: 8,
  },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 4,
    fontSize: 12,
    textAlign: "center",
  },
  revenueCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  revenueLabel: {
    color: "#FFE4E6",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  revenueValue: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "900",
    marginTop: 4,
  },
  revenueSub: {
    color: "#FFE4E6",
    fontWeight: "800",
    marginTop: 4,
  },
  boardButton: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  boardButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  quickCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  quickCardText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
  },
  refreshButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  listContent: {
    paddingBottom: 80,
  },
  loadCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.red,
  },
  cardTopRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 14,
  },
  routeColumn: {
    flex: 1,
  },
  routeText: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
  },
  routeMiddle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 4,
  },
  routeLine: {
    width: 2,
    height: 10,
    backgroundColor: COLORS.border,
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 145,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
    textTransform: "capitalize",
  },
  workflowCard: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  workflowLabel: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  workflowText: {
    color: COLORS.text,
    marginTop: 5,
    fontWeight: "700",
    lineHeight: 20,
  },
  loadTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  commodity: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 12,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  detailBox: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  detailValue: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 20,
  },
  payoutRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  payoutLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  payoutAmount: {
    color: COLORS.red,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },
  mileText: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 2,
  },
  actionStack: {
    gap: 8,
    minWidth: 145,
  },
  primaryAction: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  warningAction: {
    backgroundColor: COLORS.amber,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  transitAction: {
    backgroundColor: COLORS.purple,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  successAction: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  trackAction: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  trackActionText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  completedBadge: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  completedText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  emptyCard: {
    marginHorizontal: 18,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
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