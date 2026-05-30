// app/freight/live-route.tsx

import React, { useState } from "react";
import {
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  FreightLoad,
  getCarrierLoads,
  updateFreightLoadStatus,
} from "../data/freightLoadStore";

import {
  DriverLocation,
  getDriverLocationByLoadId,
  updateDriverCoordinates,
  updateDriverLocationStatus,
} from "../data/locationStore";

import freightTheme from "../styles/freightTheme";

export default function FreightLiveRoute() {
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [carrierId, setCarrierId] = useState("demo_carrier_1");
  const [carrierName, setCarrierName] = useState("Freight Connect Carrier");
  const [locations, setLocations] = useState<Record<string, DriverLocation>>({});

  useFocusEffect(
    React.useCallback(() => {
      loadCarrierRoutes();
    }, [])
  );

  async function loadCarrierRoutes() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight")) ||
        (await AsyncStorage.getItem("currentUser"));

      let id = "demo_carrier_1";
      let name = "Freight Connect Carrier";

      if (saved) {
        const carrier = JSON.parse(saved);

        id = carrier.id || carrier.email || "demo_carrier_1";
        name =
          carrier.companyName ||
          carrier.name ||
          carrier.ownerName ||
          carrier.fullName ||
          "Freight Connect Carrier";
      }

      setCarrierId(id);
      setCarrierName(name);

      const carrierLoads = await getCarrierLoads(id);

      const activeLoads = carrierLoads.filter((load) =>
        ["ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(load.status)
      );

      setLoads(activeLoads);

      const locationMap: Record<string, DriverLocation> = {};

      for (const load of activeLoads) {
        const location = await getDriverLocationByLoadId(load.id);

        if (location) {
          locationMap[load.id] = location;
        }
      }

      setLocations(locationMap);
    } catch (error) {
      console.log("Load carrier routes error:", error);
      setLoads([]);
      setLocations({});
    }
  }

  async function getCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Location Permission Needed",
        "Please allow location access to update delivery tracking."
      );
      return null;
    }

    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  }

  async function updateLocationForLoad(load: FreightLoad) {
    const currentLocation = await getCurrentLocation();

    if (!currentLocation) return;

    const coords = currentLocation.coords;
    const currentStatus = locations[load.id]?.status || "READY";

    const updatedLocation = await updateDriverCoordinates({
      loadId: load.id,
      carrierId,
      carrierName,
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: coords.speed ?? undefined,
      heading: coords.heading ?? undefined,
      accuracy: coords.accuracy ?? undefined,
    });

    await updateDriverLocationStatus(load.id, currentStatus);

    setLocations((prev) => ({
      ...prev,
      [load.id]: {
        ...updatedLocation,
        status: currentStatus,
      },
    }));

    Alert.alert("Location Updated", "Your live delivery location was updated.");
  }

  async function changeRouteStatus(
    load: FreightLoad,
    locationStatus: DriverLocation["status"],
    loadStatus?: FreightLoad["status"]
  ) {
    const currentLocation = await getCurrentLocation();

    if (!currentLocation) return;

    const coords = currentLocation.coords;

    const updatedLocation = await updateDriverCoordinates({
      loadId: load.id,
      carrierId,
      carrierName,
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: coords.speed ?? undefined,
      heading: coords.heading ?? undefined,
      accuracy: coords.accuracy ?? undefined,
    });

    await updateDriverLocationStatus(load.id, locationStatus);

    if (loadStatus) {
      await updateFreightLoadStatus(load.id, loadStatus, carrierName, carrierId);
    }

    setLocations((prev) => ({
      ...prev,
      [load.id]: {
        ...updatedLocation,
        status: locationStatus,
      },
    }));

    await loadCarrierRoutes();

    Alert.alert(
      "Route Updated",
      `Status updated to ${friendlyLocationStatus(locationStatus)}.`
    );
  }

  function statusColor(status?: string) {
    switch (status) {
      case "READY":
        return "#64748B";
      case "EN_ROUTE_TO_PICKUP":
        return freightTheme.colors.primary;
      case "ARRIVED_AT_PICKUP":
        return "#F59E0B";
      case "PICKED_UP":
        return "#10B981";
      case "EN_ROUTE_TO_DROPOFF":
        return "#7C3AED";
      case "ARRIVED_AT_DROPOFF":
        return "#0F766E";
      case "DELIVERED":
        return "#10B981";
      default:
        return "#64748B";
    }
  }

  function statusIcon(status?: string): keyof typeof Ionicons.glyphMap {
    switch (status) {
      case "READY":
        return "ellipse-outline";
      case "EN_ROUTE_TO_PICKUP":
        return "navigate-outline";
      case "ARRIVED_AT_PICKUP":
        return "location-outline";
      case "PICKED_UP":
        return "archive-outline";
      case "EN_ROUTE_TO_DROPOFF":
        return "trail-sign-outline";
      case "ARRIVED_AT_DROPOFF":
        return "flag-outline";
      case "DELIVERED":
        return "checkmark-done-outline";
      default:
        return "radio-outline";
    }
  }

  function friendlyLocationStatus(status?: string) {
    switch (status) {
      case "READY":
        return "Ready";
      case "EN_ROUTE_TO_PICKUP":
        return "En Route to Pickup";
      case "ARRIVED_AT_PICKUP":
        return "Arrived at Pickup";
      case "PICKED_UP":
        return "Picked Up";
      case "EN_ROUTE_TO_DROPOFF":
        return "En Route to Dropoff";
      case "ARRIVED_AT_DROPOFF":
        return "Arrived at Dropoff";
      case "DELIVERED":
        return "Delivered";
      default:
        return "Not Started";
    }
  }

  function formatDateTime(value?: string) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Not available";
    }

    return date.toLocaleString();
  }

  function renderRouteActions(load: FreightLoad) {
    const currentLocationStatus = locations[load.id]?.status || "READY";

    return (
      <View style={styles.actionGrid}>
        <MilestoneButton
          icon="navigate-outline"
          label="Start Route"
          style={styles.primaryAction}
          onPress={() => changeRouteStatus(load, "EN_ROUTE_TO_PICKUP", "ACCEPTED")}
        />

        <MilestoneButton
          icon="location-outline"
          label="Arrived Pickup"
          style={styles.warningAction}
          onPress={() =>
            changeRouteStatus(load, "ARRIVED_AT_PICKUP", "ACCEPTED")
          }
        />

        <MilestoneButton
          icon="archive-outline"
          label="Picked Up"
          style={styles.successAction}
          onPress={() => changeRouteStatus(load, "PICKED_UP", "PICKED_UP")}
        />

        <MilestoneButton
          icon="trail-sign-outline"
          label="Start Delivery"
          style={styles.purpleAction}
          onPress={() =>
            changeRouteStatus(load, "EN_ROUTE_TO_DROPOFF", "IN_TRANSIT")
          }
        />

        <MilestoneButton
          icon="flag-outline"
          label="Arrived Dropoff"
          style={styles.tealAction}
          onPress={() =>
            changeRouteStatus(load, "ARRIVED_AT_DROPOFF", "IN_TRANSIT")
          }
        />

        <MilestoneButton
          icon="checkmark-done-outline"
          label="Delivered"
          style={styles.deliveredAction}
          onPress={() => changeRouteStatus(load, "DELIVERED", "DELIVERED")}
        />

        <MilestoneButton
          icon="radio-outline"
          label="Update GPS"
          style={styles.secondaryAction}
          onPress={() => updateLocationForLoad(load)}
        />

        <View style={styles.currentStepBox}>
          <Ionicons
            name={statusIcon(currentLocationStatus)}
            size={18}
            color="#10B981"
          />
          <Text style={styles.currentStep}>
            Current step: {friendlyLocationStatus(currentLocationStatus)}
          </Text>
        </View>
      </View>
    );
  }

  function renderRouteCard({ item }: { item: FreightLoad }) {
    const location = locations[item.id];
    const currentStatus = location?.status || "READY";

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadId}>Load #{item.id.slice(-6)}</Text>
            <Text style={styles.carrierMeta}>Carrier: {carrierName}</Text>
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: statusColor(currentStatus),
              },
            ]}
          >
            <Ionicons name={statusIcon(currentStatus)} size={14} color="#FFFFFF" />
            <Text style={styles.statusText}>
              {friendlyLocationStatus(currentStatus)}
            </Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.route}>{item.pickupLocation}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.route}>{item.dropoffLocation}</Text>
            </View>
          </View>
        </View>

        <View style={styles.locationBox}>
          <View style={styles.locationHeader}>
            <Ionicons name="navigate-circle-outline" size={24} color="#10B981" />
            <Text style={styles.locationTitle}>Live GPS</Text>
          </View>

          {location ? (
            <>
              <LocationRow label="Latitude" value={location.latitude.toFixed(5)} />
              <LocationRow label="Longitude" value={location.longitude.toFixed(5)} />
              <LocationRow
                label="Accuracy"
                value={
                  location.accuracy
                    ? `${location.accuracy.toFixed(1)} meters`
                    : "Not available"
                }
              />
              <LocationRow label="Updated" value={formatDateTime(location.updatedAt)} />
            </>
          ) : (
            <Text style={styles.locationText}>
              No GPS update yet. Tap Start Route or Update GPS.
            </Text>
          )}
        </View>

        <Text style={styles.description}>{item.description}</Text>

        <View style={styles.payoutBox}>
          <Text style={styles.payoutLabel}>Carrier Payout</Text>
          <Text style={styles.payout}>
            ${Number(item.payoutAmount || 0).toFixed(2)}
          </Text>
        </View>

        {renderRouteActions(item)}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Live Route</Text>
            <Text style={styles.subtitle}>
              {carrierName} · Update GPS and route progress for active deliveries.
            </Text>
          </View>

          <View style={styles.heroIcon}>
            <Ionicons name="map-outline" size={34} color="#FFFFFF" />
          </View>
        </View>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/freight/board" as any)}
        >
          <Ionicons name="list-outline" size={18} color="#FFFFFF" />
          <Text style={styles.navText}>Load Board</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/freight/dashboard" as any)}
        >
          <Ionicons
            name="grid-outline"
            size={18}
            color={freightTheme.colors.primary}
          />
          <Text style={styles.navTextOutline}>Dashboard</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="trail-sign-outline" size={38} color="#10B981" />
            <Text style={styles.emptyTitle}>No active routes.</Text>
            <Text style={styles.emptyText}>
              Claim a load first, then use Live Route to update GPS and delivery
              progress.
            </Text>

            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push("/freight/board" as any)}
            >
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Open Load Board</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={renderRouteCard}
      />
    </SafeAreaView>
  );
}

function MilestoneButton({
  icon,
  label,
  style,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  style: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.actionButton, style]} onPress={onPress}>
      <Ionicons name={icon} size={17} color="#FFFFFF" />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function LocationRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.locationRow}>
      <Text style={styles.locationLabel}>{label}</Text>
      <Text style={styles.locationValue}>{value}</Text>
    </View>
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
    paddingHorizontal: 20,
    paddingBottom: 26,
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
  kicker: {
    color: "#10B981",
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: freightTheme.colors.text,
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    marginTop: 2,
    lineHeight: 22,
    fontWeight: "700",
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
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 90,
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    borderColor: freightTheme.colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "700",
  },
  emptyButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderColor: freightTheme.colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 10,
  },
  loadId: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  carrierMeta: {
    color: freightTheme.colors.mutedText,
    marginTop: 4,
    fontWeight: "700",
  },
  statusPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 160,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  routeBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    marginBottom: 14,
  },
  routeStop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: freightTheme.colors.border,
    marginLeft: 8,
    marginVertical: 8,
  },
  routeLabel: {
    color: freightTheme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  route: {
    color: freightTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23,
    marginTop: 3,
  },
  locationBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  locationTitle: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 18,
  },
  locationRow: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  locationLabel: {
    color: freightTheme.colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  locationValue: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    marginTop: 3,
  },
  locationText: {
    color: freightTheme.colors.text,
    fontWeight: "700",
    lineHeight: 20,
  },
  description: {
    color: "#CBD5E1",
    lineHeight: 22,
    marginBottom: 14,
    fontWeight: "700",
  },
  payoutBox: {
    backgroundColor: "#064E3B",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 14,
    marginBottom: 16,
  },
  payoutLabel: {
    color: "#BBF7D0",
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  payout: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: "47%",
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primaryAction: {
    backgroundColor: freightTheme.colors.primary,
  },
  secondaryAction: {
    backgroundColor: "#334155",
  },
  warningAction: {
    backgroundColor: "#F59E0B",
  },
  successAction: {
    backgroundColor: "#10B981",
  },
  purpleAction: {
    backgroundColor: "#7C3AED",
  },
  tealAction: {
    backgroundColor: "#0F766E",
  },
  deliveredAction: {
    backgroundColor: "#059669",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  currentStepBox: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 14,
    padding: 12,
    width: "100%",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentStep: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    flex: 1,
  },
});