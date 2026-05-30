// app/freight/dashboard.tsx

import React, { useState } from "react";
import {
  Alert,
  FlatList,
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

import freightTheme from "../styles/freightTheme";

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
  status: "OPEN" | "BOOKED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED";
  equipment?: string;
  pickupDate?: string;
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

export default function FreightDashboard() {
  const [carrierName, setCarrierName] = useState("Carrier");
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboard();
    }, [])
  );

  async function loadDashboard() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFreight")) ||
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (saved) {
        const freight = JSON.parse(saved);

        setCarrierName(
          freight.companyName ||
            freight.businessName ||
            freight.ownerName ||
            freight.fullName ||
            "Freight Connect Carrier"
        );
      } else {
        setCarrierName("Freight Connect Carrier");
      }

      setLoads(MOCK_LOADS);
    } catch (error) {
      console.log("Freight dashboard load error:", error);
      setCarrierName("Freight Connect Carrier");
      setLoads(MOCK_LOADS);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "OPEN":
        return "#2563EB";
      case "BOOKED":
        return freightTheme.colors.primary;
      case "PICKED_UP":
        return "#F59E0B";
      case "IN_TRANSIT":
        return "#7C3AED";
      case "DELIVERED":
        return "#10B981";
      default:
        return "#64748B";
    }
  }

  function getStatusIcon(status: FreightLoad["status"]) {
    switch (status) {
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

  async function acceptLoad(load: FreightLoad) {
    const updated = loads.map((item) =>
      item.id === load.id ? { ...item, status: "BOOKED" as const } : item
    );

    setLoads(updated);

    Alert.alert(
      "Load Accepted",
      `${load.title} has been assigned to your carrier account.`
    );
  }

  async function moveToPickedUp(load: FreightLoad) {
    const updated = loads.map((item) =>
      item.id === load.id ? { ...item, status: "PICKED_UP" as const } : item
    );

    setLoads(updated);
    Alert.alert("Pickup Confirmed", `${load.title} is now marked picked up.`);
  }

  async function moveToTransit(load: FreightLoad) {
    const updated = loads.map((item) =>
      item.id === load.id ? { ...item, status: "IN_TRANSIT" as const } : item
    );

    setLoads(updated);
    Alert.alert("Route Updated", `${load.title} is now in transit.`);
  }

  async function completeLoad(load: FreightLoad) {
    const updated = loads.map((item) =>
      item.id === load.id ? { ...item, status: "DELIVERED" as const } : item
    );

    setLoads(updated);
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

  const activeLoads = loads.filter((item) =>
    ["BOOKED", "PICKED_UP", "IN_TRANSIT"].includes(item.status)
  );

  const openLoads = loads.filter((item) => item.status === "OPEN");

  const completedLoads = loads.filter((item) => item.status === "DELIVERED");

  const visibleRevenue = loads.reduce(
    (sum, item) => sum + Number(item.rate || 0),
    0
  );

  function renderWorkflowText(status: FreightLoad["status"]) {
    switch (status) {
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
    if (load.status === "OPEN") {
      return (
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => acceptLoad(load)}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Accept Load</Text>
        </TouchableOpacity>
      );
    }

    if (load.status === "BOOKED") {
      return (
        <TouchableOpacity
          style={styles.warningAction}
          onPress={() => moveToPickedUp(load)}
        >
          <Ionicons name="archive-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Confirm Pickup</Text>
        </TouchableOpacity>
      );
    }

    if (load.status === "PICKED_UP") {
      return (
        <TouchableOpacity
          style={styles.transitAction}
          onPress={() => moveToTransit(load)}
        >
          <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Start Transit</Text>
        </TouchableOpacity>
      );
    }

    if (load.status === "IN_TRANSIT") {
      return (
        <TouchableOpacity
          style={styles.successAction}
          onPress={() => completeLoad(load)}
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
    const payoutPerMile =
      item.miles > 0 ? Number(item.rate || 0) / Number(item.miles) : 0;

    return (
      <View style={styles.loadCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.routeColumn}>
            <Text style={styles.routeText}>
              {item.pickupCity}, {item.pickupState}
            </Text>

            <View style={styles.routeMiddle}>
              <View style={styles.routeLine} />
              <Ionicons name="arrow-down" size={18} color={freightTheme.colors.primary} />
              <View style={styles.routeLine} />
            </View>

            <Text style={styles.routeText}>
              {item.deliveryCity}, {item.deliveryState}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusColor(item.status),
              },
            ]}
          >
            <Ionicons name={getStatusIcon(item.status)} size={14} color="#FFFFFF" />
            <Text style={styles.statusText}>{item.status.replace(/_/g, " ")}</Text>
          </View>
        </View>

        <View style={styles.workflowCard}>
          <Text style={styles.workflowLabel}>Route Workflow</Text>
          <Text style={styles.workflowText}>{renderWorkflowText(item.status)}</Text>
        </View>

        <Text style={styles.loadTitle}>{item.title}</Text>
        <Text style={styles.commodity}>{item.commodity}</Text>

        <View style={styles.detailGrid}>
          <View style={styles.detailBox}>
            <Ionicons name="calendar-outline" size={17} color="#10B981" />
            <Text style={styles.detailLabel}>Pickup</Text>
            <Text style={styles.detailValue}>{item.pickupDate || "TBD"}</Text>
          </View>

          <View style={styles.detailBox}>
            <Ionicons name="car-outline" size={17} color="#10B981" />
            <Text style={styles.detailLabel}>Equipment</Text>
            <Text style={styles.detailValue}>{item.equipment || "Standard"}</Text>
          </View>

          <View style={styles.detailBox}>
            <Ionicons name="scale-outline" size={17} color="#10B981" />
            <Text style={styles.detailLabel}>Weight</Text>
            <Text style={styles.detailValue}>{item.weight || "TBD"}</Text>
          </View>

          <View style={styles.detailBox}>
            <Ionicons name="leaf-outline" size={17} color="#10B981" />
            <Text style={styles.detailLabel}>Posted By</Text>
            <Text style={styles.detailValue}>
              {item.farmerName || "Farm2Home Partner"}
            </Text>
          </View>
        </View>

        <View style={styles.payoutRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.payoutLabel}>Carrier Payout</Text>
            <Text style={styles.payoutAmount}>${item.rate.toFixed(2)}</Text>
            <Text style={styles.mileText}>
              {item.miles} miles · ${payoutPerMile.toFixed(2)} / mile
            </Text>
          </View>

          <View style={styles.actionStack}>
            {renderAction(item)}

            {item.status !== "OPEN" && (
              <TouchableOpacity
                style={styles.trackAction}
                onPress={() => openLiveTracking(item)}
              >
                <Ionicons name="map-outline" size={18} color={freightTheme.colors.primary} />
                <Text style={styles.trackActionText}>Live Route</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>Farm2Home Freight Connect</Text>

              <Text style={styles.heroTitle}>Freight Operations Center</Text>

              <Text style={styles.heroSubtitle}>
                Manage load opportunities, dispatch status, route workflow,
                payout visibility, and delivery completion from one carrier
                workspace.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="trail-sign-outline" size={34} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.carrierRibbon}>
            <Text style={styles.carrierLabel}>Carrier Account</Text>
            <Text style={styles.carrierName}>{carrierName}</Text>
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
            <Ionicons
              name="business-outline"
              size={18}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.navTextOutline}>Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.statCard}>
            <Ionicons name="cube-outline" size={22} color="#10B981" />
            <Text style={styles.statValue}>{openLoads.length}</Text>
            <Text style={styles.statLabel}>Open Loads</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="navigate-outline" size={22} color="#10B981" />
            <Text style={styles.statValue}>{activeLoads.length}</Text>
            <Text style={styles.statLabel}>Active Routes</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="checkmark-done-outline" size={22} color="#10B981" />
            <Text style={styles.statValue}>{completedLoads.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.revenueCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.revenueLabel}>Visible Route Value</Text>
            <Text style={styles.revenueValue}>${visibleRevenue.toFixed(0)}</Text>
          </View>

          <TouchableOpacity style={styles.boardButton} onPress={openBoard}>
            <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            <Text style={styles.boardButtonText}>Open Board</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dispatch Queue</Text>

          <TouchableOpacity style={styles.refreshButton} onPress={loadDashboard}>
            <Ionicons
              name="refresh-outline"
              size={17}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={loads}
          keyExtractor={(item) => item.id}
          renderItem={renderLoad}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  heroEyebrow: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: freightTheme.colors.text,
    fontSize: 34,
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
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 18,
    padding: 14,
    marginTop: 18,
  },
  carrierLabel: {
    color: freightTheme.colors.mutedText,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  carrierName: {
    color: freightTheme.colors.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 4,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },
  navButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
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
    color: freightTheme.colors.primary,
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
    backgroundColor: freightTheme.colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "900",
    color: freightTheme.colors.primary,
    marginTop: 8,
  },
  statLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
    fontSize: 12,
    textAlign: "center",
  },
  revenueCard: {
    backgroundColor: "#064E3B",
    borderColor: "#10B981",
    borderWidth: 1,
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
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  revenueValue: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
  },
  boardButton: {
    backgroundColor: freightTheme.colors.primary,
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
    color: freightTheme.colors.text,
  },
  refreshButton: {
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  listContent: {
    paddingBottom: 80,
  },
  loadCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderLeftWidth: 4,
    borderLeftColor: freightTheme.colors.primary,
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
    color: freightTheme.colors.text,
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
    backgroundColor: freightTheme.colors.border,
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
  },
  workflowCard: {
    backgroundColor: freightTheme.colors.surface,
    padding: 12,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  workflowLabel: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  workflowText: {
    color: freightTheme.colors.text,
    marginTop: 5,
    fontWeight: "700",
    lineHeight: 20,
  },
  loadTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  commodity: {
    color: freightTheme.colors.mutedText,
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
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  detailLabel: {
    color: freightTheme.colors.mutedText,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  detailValue: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    lineHeight: 20,
  },
  payoutRow: {
    borderTopWidth: 1,
    borderTopColor: freightTheme.colors.border,
    paddingTop: 16,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  payoutLabel: {
    color: freightTheme.colors.mutedText,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  payoutAmount: {
    color: freightTheme.colors.primary,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },
  mileText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 2,
  },
  actionStack: {
    gap: 8,
    minWidth: 145,
  },
  primaryAction: {
    backgroundColor: freightTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  warningAction: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  transitAction: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  successAction: {
    backgroundColor: "#10B981",
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
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  trackActionText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  completedBadge: {
    backgroundColor: "#10B981",
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
});