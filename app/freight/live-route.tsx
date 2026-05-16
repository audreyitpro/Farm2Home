import React, { useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";

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
  const [locations, setLocations] = useState<Record<string, DriverLocation>>(
    {}
  );

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

    Alert.alert("Route Updated", `Status updated to ${friendlyLocationStatus(locationStatus)}.`);
  }

  function statusColor(status?: string) {
    switch (status) {
      case "READY":
        return "#64748B";
      case "EN_ROUTE_TO_PICKUP":
        return freightTheme.colors.primary;
      case "ARRIVED_AT_PICKUP":
        return freightTheme.colors.warning;
      case "PICKED_UP":
        return freightTheme.colors.success;
      case "EN_ROUTE_TO_DROPOFF":
        return "#A855F7";
      case "ARRIVED_AT_DROPOFF":
      case "DELIVERED":
        return "#14B8A6";
      default:
        return "#64748B";
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
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() =>
            changeRouteStatus(load, "EN_ROUTE_TO_PICKUP", "ACCEPTED")
          }
        >
          <Text style={styles.actionText}>Start Route</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.warningAction}
          onPress={() =>
            changeRouteStatus(load, "ARRIVED_AT_PICKUP", "ACCEPTED")
          }
        >
          <Text style={styles.actionText}>Arrived Pickup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.successAction}
          onPress={() => changeRouteStatus(load, "PICKED_UP", "PICKED_UP")}
        >
          <Text style={styles.actionText}>Picked Up</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.purpleAction}
          onPress={() =>
            changeRouteStatus(load, "EN_ROUTE_TO_DROPOFF", "IN_TRANSIT")
          }
        >
          <Text style={styles.actionText}>Start Delivery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tealAction}
          onPress={() =>
            changeRouteStatus(load, "ARRIVED_AT_DROPOFF", "IN_TRANSIT")
          }
        >
          <Text style={styles.actionText}>Arrived Dropoff</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deliveredAction}
          onPress={() => changeRouteStatus(load, "DELIVERED", "DELIVERED")}
        >
          <Text style={styles.actionText}>Delivered</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => updateLocationForLoad(load)}
        >
          <Text style={styles.actionText}>Update GPS</Text>
        </TouchableOpacity>

        <Text style={styles.currentStep}>
          Current step: {friendlyLocationStatus(currentLocationStatus)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Route</Text>

      <Text style={styles.subtitle}>
        {carrierName} · Update GPS and route progress for active deliveries.
      </Text>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/freight/board" as any)}
        >
          <Text style={styles.navText}>Load Board</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/freight/dashboard" as any)}
        >
          <Text style={styles.navTextOutline}>Dashboard</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active routes.</Text>
            <Text style={styles.emptyText}>
              Claim a load first, then use Live Route to update GPS and delivery
              progress.
            </Text>

            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push("/freight/board" as any)}
            >
              <Text style={styles.emptyButtonText}>Open Load Board</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const location = locations[item.id];

          return (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.loadId}>Load #{item.id.slice(-6)}</Text>

                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: statusColor(location?.status || "READY"),
                    },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {friendlyLocationStatus(location?.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.route}>{item.pickupLocation}</Text>
              <Text style={styles.arrow}>→</Text>
              <Text style={styles.route}>{item.dropoffLocation}</Text>

              <View style={styles.locationBox}>
                <Text style={styles.locationTitle}>Live GPS</Text>

                {location ? (
                  <>
                    <Text style={styles.locationText}>
                      Latitude: {location.latitude.toFixed(5)}
                    </Text>

                    <Text style={styles.locationText}>
                      Longitude: {location.longitude.toFixed(5)}
                    </Text>

                    <Text style={styles.locationText}>
                      Accuracy:{" "}
                      {location.accuracy
                        ? `${location.accuracy.toFixed(1)} meters`
                        : "Not available"}
                    </Text>

                    <Text style={styles.locationText}>
                      Updated: {formatDateTime(location.updatedAt)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.locationText}>
                    No GPS update yet. Tap Start Route or Update GPS.
                  </Text>
                )}
              </View>

              <Text style={styles.description}>{item.description}</Text>

              <Text style={styles.payout}>
                Payout: ${Number(item.payoutAmount || 0).toFixed(2)}
              </Text>

              {renderRouteActions(item)}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    padding: 18,
    paddingTop: 50,
  },
  title: {
    color: freightTheme.colors.text,
    fontSize: 32,
    fontWeight: "900",
  },
  subtitle: {
    color: freightTheme.colors.mutedText,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 22,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  navButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navTextOutline: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    borderColor: freightTheme.colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 16,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderColor: freightTheme.colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  loadId: {
    color: freightTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  route: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  arrow: {
    color: freightTheme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
    marginVertical: 4,
  },
  locationBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    marginBottom: 14,
  },
  locationTitle: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    marginBottom: 8,
    fontSize: 16,
  },
  locationText: {
    color: freightTheme.colors.text,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 20,
  },
  description: {
    color: "#CBD5E1",
    lineHeight: 22,
    marginBottom: 14,
  },
  payout: {
    color: freightTheme.colors.success,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryAction: {
    backgroundColor: freightTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryAction: {
    backgroundColor: "#334155",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  warningAction: {
    backgroundColor: freightTheme.colors.warning,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  successAction: {
    backgroundColor: freightTheme.colors.success,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  purpleAction: {
    backgroundColor: "#A855F7",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tealAction: {
    backgroundColor: "#14B8A6",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  deliveredAction: {
    backgroundColor: "#0F766E",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  currentStep: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    width: "100%",
    marginTop: 8,
  },
});