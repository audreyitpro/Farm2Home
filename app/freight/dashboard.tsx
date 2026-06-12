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

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",

  tracking: "/freight/tracking",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  routeExceptions: "/freight/route-exceptions",
  loadIssues: "/freight/load-issues",

  communicationCenter: "/freight/communication-center",
  loadChat: "/freight/load-chat",
  dispatchAlerts: "/freight/dispatch-alerts",
  notifications: "/freight/notifications",

  serviceArea: "/freight/service-area",
  aiLoadMatching: "/freight/ai-load-matching",
  loadRecommendations: "/freight/load-recommendations",
  rateOptimizer: "/freight/rate-optimizer",
  costCalculator: "/freight/cost-calculator",

  fuelTracker: "/freight/fuel-tracker",
  maintenanceTracker: "/freight/maintenance-tracker",
  expenseCenter: "/freight/expense-center",
  profitabilityDashboard: "/freight/profitability-dashboard",
  taxCenter: "/freight/tax-center",
  yearEndSummary: "/freight/year-end-summary",
  reportExport: "/freight/report-export",

  businessDocuments: "/freight/business-documents",
  complianceVault: "/freight/compliance-vault",
  reviewStatus: "/freight/review-status",
  safety: "/freight/safety",
  insurance: "/freight/insurance",
  adminReview: "/freight/admin-review",

  settlements: "/freight/settlements",
  payoutCenter: "/freight/payout-center",
  deliveryHistory: "/freight/delivery-history",
  analytics: "/freight/analytics",
  earnings: "/freight/earnings",
  connectBank: "/freight/connect-bank",

  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  subscription: "/freight/subscription",
  managementCenter: "/freight/freight-management-center",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type FreightStatus =
  | "OPEN"
  | "BOOKED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

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
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  purple: "#7C3AED",
  blue: "#2563EB",
  slate: "#64748B",
};

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

  if (value === "available" || value === "open") return "OPEN";
  if (value === "accepted" || value === "assigned" || value === "booked") return "BOOKED";
  if (value === "picked_up" || value === "arrived_pickup") return "PICKED_UP";
  if (value === "in_transit" || value === "arrived_dropoff") return "IN_TRANSIT";
  if (value === "delivered" || value === "completed") return "DELIVERED";
  if (value === "cancelled") return "CANCELLED";

  return "OPEN";
}

function toDbStatus(status: FreightStatus) {
  if (status === "OPEN") return "available";
  if (status === "BOOKED") return "accepted";
  if (status === "PICKED_UP") return "picked_up";
  if (status === "IN_TRANSIT") return "in_transit";
  if (status === "DELIVERED") return "delivered";
  return "cancelled";
}

function mapDbLoad(row: any): FreightLoad {
  const pickup = splitCityState(row.pickup_location || row.pickup_address);
  const dropoff = splitCityState(row.dropoff_location || row.dropoff_address);

  return {
    ...row,
    id: String(row.id),
    title: row.title || row.commodity || "Freight Load",
    commodity: row.commodity || "Farm Freight",
    pickupCity: pickup.city,
    pickupState: pickup.state,
    deliveryCity: dropoff.city,
    deliveryState: dropoff.state,
    rate: Number(row.rate || row.freight_total || row.total_due || row.payout_amount || 0),
    miles: Number(row.distance_miles || row.miles || 0),
    weight: row.weight_lbs
      ? `${Number(row.weight_lbs).toLocaleString()} lbs`
      : row.weight || "TBD",
    farmerName: row.farmer_name || row.farmerName || "Farm2Home Partner",
    status: mapDbStatus(row.status),
    equipment: row.equipment_type || row.equipment || "Standard",
    pickupDate:
      row.pickup_date && row.pickup_time
        ? `${row.pickup_date} · ${row.pickup_time}`
        : row.pickup_date || row.pickupDate || "TBD",
  };
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrierName, setCarrierName] = useState("Freight Connect Carrier");
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
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
    setCarrierName(normalizedCarrier.companyName);
    return normalizedCarrier;
  }

  async function loadDashboard() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace("/freight/login" as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.log("Freight dashboard carrier error:", error.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "Please complete freight registration first."
        );
        router.replace("/freight/register" as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        role: "freight",
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
        membershipStatus:
          dbCarrier.membership_status || stored?.membershipStatus || "Active",
        subscriptionStatus:
          dbCarrier.subscription_status || stored?.subscriptionStatus || "active",
      });

      await loadFreightLoads(mergedCarrier.id);
    } catch (error) {
      console.log("Freight dashboard load error:", error);
      Alert.alert("Dashboard Error", "Unable to load freight dashboard.");
      setLoads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadFreightLoads(carrierId: string) {
    try {
      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `status.eq.available,status.eq.open,carrier_id.eq.${carrierId},freight_user_id.eq.${carrierId},driver_id.eq.${carrierId},accepted_by.eq.${carrierId}`
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight loads error:", error.message);
        setLoads([]);
        return;
      }

      setLoads(Array.isArray(data) ? data.map(mapDbLoad) : []);
    } catch (error) {
      console.log("Freight load sync skipped:", error);
      setLoads([]);
    }
  }

  async function refreshDashboard() {
    setRefreshing(true);
    await loadDashboard();
  }

  async function updateLoadStatus(load: FreightLoad, nextStatus: FreightStatus) {
    if (!carrier?.id) {
      Alert.alert("Carrier Missing", "Please log in again.");
      return;
    }

    const now = new Date().toISOString();

    const updatePayload: any = {
      status: toDbStatus(nextStatus),
      updated_at: now,
    };

    if (nextStatus === "BOOKED") {
      updatePayload.carrier_id = carrier.id;
      updatePayload.freight_user_id = carrier.id;
      updatePayload.accepted_by = carrier.id;
      updatePayload.accepted_at = now;
      updatePayload.carrier_name = carrier.companyName || carrier.businessName || carrierName;
      updatePayload.carrier_email = carrier.email || null;
    }

    if (nextStatus === "PICKED_UP") updatePayload.picked_up_at = now;
    if (nextStatus === "DELIVERED") {
      updatePayload.delivered_at = now;
      updatePayload.settlement_status = "pending";
      updatePayload.payout_status = "pending";
    }

    const { error } = await supabase
      .from("freight_loads")
      .update(updatePayload)
      .eq("id", load.id);

    if (error) {
      Alert.alert("Update Failed", error.message);
      return;
    }

    await supabase.from("freight_notifications").insert({
      freight_user_id: carrier.id,
      load_id: load.id,
      title:
        nextStatus === "BOOKED"
          ? "Load Accepted"
          : nextStatus === "PICKED_UP"
          ? "Pickup Confirmed"
          : nextStatus === "IN_TRANSIT"
          ? "Load In Transit"
          : nextStatus === "DELIVERED"
          ? "Delivery Completed"
          : "Load Updated",
      message: `${load.title} is now ${nextStatus.replace(/_/g, " ")}.`,
      type: "load",
      is_read: false,
      created_at: now,
    });

    await loadFreightLoads(carrier.id);
  }

  async function acceptLoad(load: FreightLoad) {
    await updateLoadStatus(load, "BOOKED");

    Alert.alert("Load Accepted", `${load.title} has been assigned to your carrier account.`, [
      {
        text: "View My Loads",
        onPress: () => goTo(FREIGHT_ROUTES.myLoads),
      },
      {
        text: "Stay Here",
        style: "cancel",
      },
    ]);
  }

  const openLoads = useMemo(
    () => loads.filter((item) => mapDbStatus(item.status) === "OPEN"),
    [loads]
  );

  const activeLoads = useMemo(
    () =>
      loads.filter((item) =>
        ["BOOKED", "PICKED_UP", "IN_TRANSIT"].includes(mapDbStatus(item.status))
      ),
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

  function openLoadRoute(route: FreightRoute, load?: FreightLoad) {
    if (!load) {
      goTo(route);
      return;
    }

    router.push({
      pathname: route as any,
      params: {
        loadId: load.id,
      },
    });
  }

  function getStatusColor(status: FreightStatus) {
    switch (status) {
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
        <TouchableOpacity
          style={styles.warningAction}
          onPress={() => updateLoadStatus(load, "PICKED_UP")}
        >
          <Ionicons name="archive-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Confirm Pickup</Text>
        </TouchableOpacity>
      );
    }

    if (status === "PICKED_UP") {
      return (
        <TouchableOpacity
          style={styles.transitAction}
          onPress={() => updateLoadStatus(load, "IN_TRANSIT")}
        >
          <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Start Transit</Text>
        </TouchableOpacity>
      );
    }

    if (status === "IN_TRANSIT") {
      return (
        <TouchableOpacity
          style={styles.successAction}
          onPress={() => updateLoadStatus(load, "DELIVERED")}
        >
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
    const payoutPerMile = item.miles > 0 ? item.rate / item.miles : 0;

    return (
      <View style={styles.loadCard}>
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title}</Text>
            <Text style={styles.commodity}>{item.commodity}</Text>
            <Text style={styles.routeText}>
              {item.pickupCity}, {item.pickupState} → {item.deliveryCity},{" "}
              {item.deliveryState}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
            <Text style={styles.statusText}>{status.replace(/_/g, " ")}</Text>
          </View>
        </View>

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

            <TouchableOpacity
              style={styles.trackAction}
              onPress={() => openLoadRoute(FREIGHT_ROUTES.routeDetails, item)}
            >
              <Ionicons name="document-text-outline" size={18} color={COLORS.red} />
              <Text style={styles.trackActionText}>Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.trackAction}
              onPress={() => openLoadRoute(FREIGHT_ROUTES.liveRoute, item)}
            >
              <Ionicons name="map-outline" size={18} color={COLORS.red} />
              <Text style={styles.trackActionText}>Live Route</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.trackAction}
              onPress={() => openLoadRoute(FREIGHT_ROUTES.loadChat, item)}
            >
              <Ionicons name="chatbubble-outline" size={18} color={COLORS.red} />
              <Text style={styles.trackActionText}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const quickActions: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: FreightRoute;
  }[] = [
    { title: "My Loads", icon: "briefcase-outline", route: FREIGHT_ROUTES.myLoads },
    { title: "Live Loads", icon: "pulse-outline", route: FREIGHT_ROUTES.liveLoads },
    { title: "Freight Tracking", icon: "navigate-outline", route: FREIGHT_ROUTES.tracking },
    { title: "Live Route", icon: "map-outline", route: FREIGHT_ROUTES.liveRoute },
    { title: "Route Details", icon: "trail-sign-outline", route: FREIGHT_ROUTES.routeDetails },
    { title: "Route Exceptions", icon: "warning-outline", route: FREIGHT_ROUTES.routeExceptions },
    { title: "Load Issues", icon: "alert-circle-outline", route: FREIGHT_ROUTES.loadIssues },
    { title: "Chat Center", icon: "chatbubbles-outline", route: FREIGHT_ROUTES.communicationCenter },
    { title: "Load Chat", icon: "chatbubble-outline", route: FREIGHT_ROUTES.loadChat },
    { title: "Dispatch Alerts", icon: "megaphone-outline", route: FREIGHT_ROUTES.dispatchAlerts },
    { title: "Notifications", icon: "notifications-outline", route: FREIGHT_ROUTES.notifications },
    { title: "Payout Center", icon: "wallet-outline", route: FREIGHT_ROUTES.payoutCenter },
    { title: "Settlements", icon: "receipt-outline", route: FREIGHT_ROUTES.settlements },
    { title: "Delivery History", icon: "time-outline", route: FREIGHT_ROUTES.deliveryHistory },
    { title: "Earnings", icon: "cash-outline", route: FREIGHT_ROUTES.earnings },
    { title: "Analytics", icon: "bar-chart-outline", route: FREIGHT_ROUTES.analytics },
    { title: "Connect Bank", icon: "business-outline", route: FREIGHT_ROUTES.connectBank },
    { title: "Documents", icon: "folder-open-outline", route: FREIGHT_ROUTES.businessDocuments },
    { title: "Compliance Vault", icon: "shield-checkmark-outline", route: FREIGHT_ROUTES.complianceVault },
    { title: "Review Status", icon: "clipboard-outline", route: FREIGHT_ROUTES.reviewStatus },
    { title: "Safety", icon: "medical-outline", route: FREIGHT_ROUTES.safety },
    { title: "Insurance", icon: "umbrella-outline", route: FREIGHT_ROUTES.insurance },
    { title: "Admin Review", icon: "reader-outline", route: FREIGHT_ROUTES.adminReview },
    { title: "Service Area", icon: "map-outline", route: FREIGHT_ROUTES.serviceArea },
    { title: "AI Matching", icon: "sparkles-outline", route: FREIGHT_ROUTES.aiLoadMatching },
    { title: "Recommendations", icon: "bulb-outline", route: FREIGHT_ROUTES.loadRecommendations },
    { title: "Rate Optimizer", icon: "trending-up-outline", route: FREIGHT_ROUTES.rateOptimizer },
    { title: "Cost Calculator", icon: "calculator-outline", route: FREIGHT_ROUTES.costCalculator },
    { title: "Fuel Tracker", icon: "speedometer-outline", route: FREIGHT_ROUTES.fuelTracker },
    { title: "Maintenance", icon: "construct-outline", route: FREIGHT_ROUTES.maintenanceTracker },
    { title: "Expenses", icon: "receipt-outline", route: FREIGHT_ROUTES.expenseCenter },
    { title: "Profitability", icon: "analytics-outline", route: FREIGHT_ROUTES.profitabilityDashboard },
    { title: "Taxes", icon: "document-text-outline", route: FREIGHT_ROUTES.taxCenter },
    { title: "Year End", icon: "calendar-outline", route: FREIGHT_ROUTES.yearEndSummary },
    { title: "Export Reports", icon: "download-outline", route: FREIGHT_ROUTES.reportExport },
    { title: "Profile", icon: "person-outline", route: FREIGHT_ROUTES.profile },
    { title: "Settings", icon: "settings-outline", route: FREIGHT_ROUTES.settings },
    { title: "Support", icon: "headset-outline", route: FREIGHT_ROUTES.support },
    { title: "Help", icon: "help-circle-outline", route: FREIGHT_ROUTES.help },
  ];

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
                Manage load opportunities, dispatch, tracking, documents, payout visibility,
                and delivery completion from one carrier workspace.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.heroIcon}
              onPress={() => goTo(FREIGHT_ROUTES.notifications)}
            >
              <Ionicons name="notifications-outline" size={34} color="#FFFFFF" />
            </TouchableOpacity>
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
          <TouchableOpacity style={styles.navButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Load Board</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => goTo(FREIGHT_ROUTES.communicationCenter)}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={COLORS.red} />
            <Text style={styles.navTextOutline}>Chat Center</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard icon="cube-outline" label="Open Loads" value={openLoads.length} route={FREIGHT_ROUTES.board} />
          <MetricCard icon="navigate-outline" label="Active Routes" value={activeLoads.length} route={FREIGHT_ROUTES.liveRoute} />
          <MetricCard icon="checkmark-done-outline" label="Completed" value={completedLoads.length} route={FREIGHT_ROUTES.deliveryHistory} />
        </View>

        <View style={styles.revenueCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.revenueLabel}>Visible Route Value</Text>
            <Text style={styles.revenueValue}>{money(visibleRevenue)}</Text>
            <Text style={styles.revenueSub}>Active value: {money(activeRevenue)}</Text>
          </View>

          <TouchableOpacity style={styles.boardButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.boardButtonText}>Open Board</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickGrid}>
          {quickActions.map((item) => (
            <QuickAction key={item.title} title={item.title} icon={item.icon} route={item.route} />
          ))}
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

function MetricCard({
  icon,
  label,
  value,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.statCard} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function DetailBox({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailBox}>
      <Ionicons name={icon} size={17} color={COLORS.red} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function QuickAction({
  title,
  icon,
  route,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={23} color={COLORS.red} />
      <Text style={styles.quickCardText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 28,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
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
  heroTitle: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
  heroSubtitle: { color: "#D1D5DB", lineHeight: 23, fontSize: 15, fontWeight: "700" },
  carrierRibbon: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  carrierLabel: { color: "#FCA5A5", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  carrierName: { color: "#FFFFFF", fontSize: 19, fontWeight: "900", marginTop: 4 },
  carrierSub: { color: "#D1D5DB", fontWeight: "700", marginTop: 4 },
  navRow: { flexDirection: "row", gap: 10, padding: 18 },
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
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navTextOutline: { color: COLORS.red, fontWeight: "900" },
  metricsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { fontSize: 28, fontWeight: "900", color: COLORS.black, marginTop: 8 },
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
  revenueLabel: { color: "#FFE4E6", fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  revenueValue: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", marginTop: 4 },
  revenueSub: { color: "#FFE4E6", fontWeight: "800", marginTop: 4 },
  boardButton: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  boardButtonText: { color: "#FFFFFF", fontWeight: "900" },
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
  quickCardText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 24, fontWeight: "900", color: COLORS.text },
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
  refreshText: { color: COLORS.red, fontWeight: "900" },
  listContent: { paddingBottom: 80 },
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
  cardTopRow: { flexDirection: "row", gap: 12, justifyContent: "space-between", marginBottom: 14 },
  loadTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginBottom: 4 },
  commodity: { color: COLORS.muted, fontWeight: "800", marginBottom: 8 },
  routeText: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
    maxWidth: 145,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
    textTransform: "capitalize",
  },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
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
  detailValue: { color: COLORS.text, fontWeight: "800", lineHeight: 20 },
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
  payoutLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  payoutAmount: { color: COLORS.red, fontSize: 30, fontWeight: "900", marginTop: 4 },
  mileText: { color: COLORS.muted, fontWeight: "800", marginTop: 2 },
  actionStack: { gap: 8, minWidth: 145 },
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
  primaryActionText: { color: "#FFFFFF", fontWeight: "900" },
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
  trackActionText: { color: COLORS.red, fontWeight: "900" },
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
  completedText: { color: "#FFFFFF", fontWeight: "900" },
  emptyCard: {
    marginHorizontal: 18,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
});