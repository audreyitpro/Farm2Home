import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  ScrollView,
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
  updateDriverCoordinates,
  updateDriverLocationStatus,
} from "../data/locationStore";

import { supabase } from "../data/supabaseClient";
import freightTheme from "../styles/freightTheme";

type StopStatus = "PENDING" | "EN_ROUTE" | "ARRIVED" | "COMPLETED";

type NavigationStop = {
  id: string;
  loadId: string;
  type: "PICKUP" | "DROPOFF";
  title: string;
  address: string;
  status: StopStatus;
};

type ChecklistState = {
  vehicleChecked: boolean;
  coldChainConfirmed: boolean;
  packageSecured: boolean;
  customerContacted: boolean;
  proofReady: boolean;
};

export default function FreightNavigationAssistant() {
  const [loading, setLoading] = useState(false);
  const [carrierId, setCarrierId] = useState("demo_carrier_1");
  const [carrierName, setCarrierName] = useState("Freight Connect Carrier");
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [selectedLoad, setSelectedLoad] = useState<FreightLoad | null>(null);
  const [stops, setStops] = useState<NavigationStop[]>([]);
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);

  const [checklist, setChecklist] = useState<ChecklistState>({
    vehicleChecked: false,
    coldChainConfirmed: false,
    packageSecured: false,
    customerContacted: false,
    proofReady: false,
  });

  useFocusEffect(
    useCallback(() => {
      loadNavigationData();
    }, [])
  );

  async function loadNavigationData(keepLoadId?: string) {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight"));

      let id = "demo_carrier_1";
      let name = "Freight Connect Carrier";

      if (saved) {
        const carrier = JSON.parse(saved);
        id = carrier.id || carrier.email || "demo_carrier_1";
        name =
          carrier.companyName ||
          carrier.name ||
          carrier.ownerName ||
          "Freight Connect Carrier";
      }

      setCarrierId(id);
      setCarrierName(name);

      const carrierLoads = await getCarrierLoads(id);

      const activeLoads = carrierLoads.filter((load) =>
        ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "DELIVERED"].includes(
          String(load.status)
        )
      );

      setLoads(activeLoads);

      const loadToSelect =
        activeLoads.find((load) => load.id === keepLoadId) ||
        activeLoads.find((load) => load.id === selectedLoad?.id) ||
        activeLoads[0] ||
        null;

      if (loadToSelect) {
        selectLoad(loadToSelect);
      } else {
        setSelectedLoad(null);
        setStops([]);
      }

      await refreshDriverLocation(false);
    } catch (error) {
      console.log("Navigation assistant load error:", error);
      Alert.alert("Load Error", "Unable to load navigation assistant.");
    } finally {
      setLoading(false);
    }
  }

  function selectLoad(load: FreightLoad) {
    setSelectedLoad(load);

    const pickupStop: NavigationStop = {
      id: `${load.id}_pickup`,
      loadId: load.id,
      type: "PICKUP",
      title: "Farm Pickup",
      address: load.pickupLocation,
      status:
        load.status === "PICKED_UP" ||
        load.status === "IN_TRANSIT" ||
        load.status === "DELIVERED"
          ? "COMPLETED"
          : "PENDING",
    };

    const dropoffStop: NavigationStop = {
      id: `${load.id}_dropoff`,
      loadId: load.id,
      type: "DROPOFF",
      title: "Customer / Market Dropoff",
      address: load.dropoffLocation,
      status:
        load.status === "DELIVERED"
          ? "COMPLETED"
          : load.status === "IN_TRANSIT"
          ? "EN_ROUTE"
          : "PENDING",
    };

    setStops([pickupStop, dropoffStop]);
  }

  async function refreshDriverLocation(showAlert = true) {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        if (showAlert) {
          Alert.alert(
            "Location Permission Needed",
            "Please allow location access for navigation and ETA updates."
          );
        }
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setCurrentLocation(location);
      return location;
    } catch (error) {
      console.log("GPS refresh error:", error);
      if (showAlert) {
        Alert.alert("GPS Error", "Unable to refresh your current location.");
      }
      return null;
    }
  }

  async function saveGpsToCloud(params: {
    loadId: string;
    latitude: number;
    longitude: number;
    speed?: number | null;
    status: DriverLocation["status"];
  }) {
    try {
      const { data: carrierRecord } = await supabase
        .from("freight_carriers")
        .select("id")
        .or(`id.eq.${carrierId},email.eq.${carrierId}`)
        .maybeSingle();

      const { data: existing } = await supabase
        .from("driver_locations")
        .select("id")
        .eq("load_id", params.loadId)
        .maybeSingle();

      const payload = {
        carrier_id: carrierRecord?.id || null,
        load_id: params.loadId,
        latitude: params.latitude,
        longitude: params.longitude,
        speed: params.speed ?? null,
        status: params.status,
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        await supabase
          .from("driver_locations")
          .update(payload)
          .eq("id", existing.id);
      } else {
        await supabase.from("driver_locations").insert(payload);
      }
    } catch (error) {
      console.log("Navigation cloud GPS error:", error);
    }
  }

  async function updateRouteProgress(params: {
    load: FreightLoad;
    gpsStatus: DriverLocation["status"];
    loadStatus?: FreightLoad["status"];
    stopId?: string;
    stopStatus?: StopStatus;
  }) {
    const location = await refreshDriverLocation();

    if (!location) return;

    const coords = location.coords;

    await updateDriverCoordinates({
      loadId: params.load.id,
      carrierId,
      carrierName,
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: coords.speed ?? undefined,
      heading: coords.heading ?? undefined,
      accuracy: coords.accuracy ?? undefined,
    });

    await updateDriverLocationStatus(params.load.id, params.gpsStatus);

    await saveGpsToCloud({
      loadId: params.load.id,
      latitude: coords.latitude,
      longitude: coords.longitude,
      speed: coords.speed,
      status: params.gpsStatus,
    });

    if (params.loadStatus) {
      await updateFreightLoadStatus(
        params.load.id,
        params.loadStatus,
        carrierName,
        carrierId
      );

      const cloudStatus =
        params.loadStatus === "ACCEPTED" ? "BOOKED" : params.loadStatus;

      await supabase
        .from("freight_loads")
        .update({
          status: cloudStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.load.id);
    }

    if (params.stopId && params.stopStatus) {
      setStops((prev) =>
        prev.map((stop) =>
          stop.id === params.stopId
            ? {
                ...stop,
                status: params.stopStatus || stop.status,
              }
            : stop
        )
      );
    }

    await loadNavigationData(params.load.id);

    Alert.alert("Navigation Updated", "Route progress was updated.");
  }

  function toggleChecklist(key: keyof ChecklistState) {
    setChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function checklistComplete() {
    return Object.values(checklist).every(Boolean);
  }

  function openExternalNavigation(address: string) {
    const encodedAddress = encodeURIComponent(address);

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${encodedAddress}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Navigation Error", "Unable to open maps.");
    });
  }

  function estimateEtaText(load: FreightLoad) {
    const miles = Number((load as any).miles || 0);

    if (miles > 0) {
      const minutes = Math.ceil((miles / 42) * 60);
      return `${minutes} min estimated`;
    }

    if (load.status === "ACCEPTED") return "Pickup route ready";
    if (load.status === "PICKED_UP") return "Delivery route ready";
    if (load.status === "IN_TRANSIT") return "Delivery in progress";

    return "ETA pending";
  }

  function getStopColor(status: StopStatus) {
    switch (status) {
      case "PENDING":
        return "#64748B";
      case "EN_ROUTE":
        return "#2563EB";
      case "ARRIVED":
        return "#F59E0B";
      case "COMPLETED":
        return "#10B981";
      default:
        return "#64748B";
    }
  }

  function renderChecklistButton(label: string, key: keyof ChecklistState) {
    const active = checklist[key];

    return (
      <TouchableOpacity
        style={[styles.checkItem, active && styles.checkItemActive]}
        onPress={() => toggleChecklist(key)}
      >
        <Text style={[styles.checkText, active && styles.checkTextActive]}>
          {active ? "✓ " : ""}
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  function renderLoadCard(load: FreightLoad) {
    const active = selectedLoad?.id === load.id;

    return (
      <TouchableOpacity
        key={load.id}
        style={[styles.loadChip, active && styles.loadChipActive]}
        onPress={() => selectLoad(load)}
      >
        <Text style={[styles.loadChipTitle, active && styles.loadChipTitleActive]}>
          #{load.id.slice(-6)}
        </Text>
        <Text style={[styles.loadChipText, active && styles.loadChipTextActive]}>
          {load.pickupLocation} → {load.dropoffLocation}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Freight</Text>
        <Text style={styles.title}>Navigation Assistant</Text>
        <Text style={styles.subtitle}>
          Driver checklist, GPS updates, stop workflow, ETA support, and route
          launch for active freight deliveries.
        </Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/freight/board")}
        >
          <Text style={styles.navText}>Load Board</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/freight/live-route")}
        >
          <Text style={styles.navTextOutline}>Live Route</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={freightTheme.colors.primary} />
          <Text style={styles.loadingText}>Loading navigation assistant...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Carrier</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>🚛 {carrierName}</Text>
            <Text style={styles.metaText}>Active loads: {loads.length}</Text>
            <Text style={styles.metaText}>
              Current GPS:{" "}
              {currentLocation
                ? `${currentLocation.coords.latitude.toFixed(
                    5
                  )}, ${currentLocation.coords.longitude.toFixed(5)}`
                : "Not updated yet"}
            </Text>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => refreshDriverLocation()}
            >
              <Text style={styles.refreshText}>Refresh GPS</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Active Loads</Text>

          {loads.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active loads.</Text>
              <Text style={styles.emptyText}>
                Claim a load from the freight board before using navigation.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.loadScroller}
            >
              {loads.map(renderLoadCard)}
            </ScrollView>
          )}

          {selectedLoad && (
            <>
              <Text style={styles.sectionTitle}>Selected Route</Text>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Load #{selectedLoad.id.slice(-6)}
                </Text>

                <Text style={styles.routeText}>
                  📍 {selectedLoad.pickupLocation}
                </Text>

                <Text style={styles.arrow}>→</Text>

                <Text style={styles.routeText}>
                  🏁 {selectedLoad.dropoffLocation}
                </Text>

                <Text style={styles.metaText}>
                  Type: {selectedLoad.loadType}
                </Text>

                <Text style={styles.metaText}>
                  Payout: ${Number(selectedLoad.payoutAmount || 0).toFixed(2)}
                </Text>

                <Text style={styles.metaText}>
                  ETA: {estimateEtaText(selectedLoad)}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Driver Checklist</Text>

              <View style={styles.checkGrid}>
                {renderChecklistButton("Vehicle inspected", "vehicleChecked")}
                {renderChecklistButton(
                  "Cold chain confirmed",
                  "coldChainConfirmed"
                )}
                {renderChecklistButton("Load secured", "packageSecured")}
                {renderChecklistButton(
                  "Customer/farm contacted",
                  "customerContacted"
                )}
                {renderChecklistButton("Proof of delivery ready", "proofReady")}
              </View>

              {!checklistComplete() && (
                <Text style={styles.warningText}>
                  Complete checklist before final delivery confirmation.
                </Text>
              )}

              <Text style={styles.sectionTitle}>Stops</Text>

              <FlatList
                data={stops}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.stopCard}>
                    <View style={styles.stopHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stopTitle}>{item.title}</Text>
                        <Text style={styles.stopAddress}>{item.address}</Text>
                      </View>

                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: getStopColor(item.status) },
                        ]}
                      >
                        <Text style={styles.statusText}>{item.status}</Text>
                      </View>
                    </View>

                    <View style={styles.stopActions}>
                      <TouchableOpacity
                        style={styles.mapButton}
                        onPress={() => openExternalNavigation(item.address)}
                      >
                        <Text style={styles.actionText}>Open Maps</Text>
                      </TouchableOpacity>

                      {item.type === "PICKUP" ? (
                        <>
                          <TouchableOpacity
                            style={styles.blueButton}
                            onPress={() =>
                              updateRouteProgress({
                                load: selectedLoad,
                                gpsStatus: "EN_ROUTE_TO_PICKUP",
                                loadStatus: "ACCEPTED",
                                stopId: item.id,
                                stopStatus: "EN_ROUTE",
                              })
                            }
                          >
                            <Text style={styles.actionText}>En Route</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.orangeButton}
                            onPress={() =>
                              updateRouteProgress({
                                load: selectedLoad,
                                gpsStatus: "ARRIVED_AT_PICKUP",
                                loadStatus: "ACCEPTED",
                                stopId: item.id,
                                stopStatus: "ARRIVED",
                              })
                            }
                          >
                            <Text style={styles.actionText}>Arrived</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.greenButton}
                            onPress={() =>
                              updateRouteProgress({
                                load: selectedLoad,
                                gpsStatus: "PICKED_UP",
                                loadStatus: "PICKED_UP",
                                stopId: item.id,
                                stopStatus: "COMPLETED",
                              })
                            }
                          >
                            <Text style={styles.actionText}>Picked Up</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={styles.blueButton}
                            onPress={() =>
                              updateRouteProgress({
                                load: selectedLoad,
                                gpsStatus: "EN_ROUTE_TO_DROPOFF",
                                loadStatus: "IN_TRANSIT",
                                stopId: item.id,
                                stopStatus: "EN_ROUTE",
                              })
                            }
                          >
                            <Text style={styles.actionText}>Start Delivery</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.orangeButton}
                            onPress={() =>
                              updateRouteProgress({
                                load: selectedLoad,
                                gpsStatus: "ARRIVED_AT_DROPOFF",
                                loadStatus: "IN_TRANSIT",
                                stopId: item.id,
                                stopStatus: "ARRIVED",
                              })
                            }
                          >
                            <Text style={styles.actionText}>Arrived</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.greenButton,
                              !checklistComplete() && styles.disabledButton,
                            ]}
                            disabled={!checklistComplete()}
                            onPress={() =>
                              updateRouteProgress({
                                load: selectedLoad,
                                gpsStatus: "DELIVERED",
                                loadStatus: "DELIVERED",
                                stopId: item.id,
                                stopStatus: "COMPLETED",
                              })
                            }
                          >
                            <Text style={styles.actionText}>Delivered</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )}
              />

              <TouchableOpacity
                style={styles.chatButton}
                onPress={() =>
                  router.push({
                    pathname: "/chat/chat-center",
                    params: {
                      conversationId: `load_${selectedLoad.id}`,
                      loadId: selectedLoad.id,
                    },
                  })
                }
              >
                <Text style={styles.chatText}>Open Load Chat</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  hero: {
    backgroundColor: "#111827",
    paddingTop: 62,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
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
  loadingCard: {
    backgroundColor: freightTheme.colors.card,
    margin: 18,
    padding: 26,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 10,
    fontWeight: "800",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  cardTitle: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 10,
  },
  metaText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 21,
  },
  refreshButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 18,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
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
  loadScroller: {
    paddingLeft: 18,
    marginBottom: 16,
  },
  loadChip: {
    width: 260,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 18,
    padding: 14,
    marginRight: 12,
  },
  loadChipActive: {
    backgroundColor: freightTheme.colors.primary,
    borderColor: freightTheme.colors.primary,
  },
  loadChipTitle: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 5,
  },
  loadChipTitleActive: {
    color: "#FFFFFF",
  },
  loadChipText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
  },
  loadChipTextActive: {
    color: "#E0F2FE",
  },
  routeText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 24,
  },
  arrow: {
    color: freightTheme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
    marginVertical: 6,
  },
  checkGrid: {
    paddingHorizontal: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  checkItem: {
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
  },
  checkItemActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  checkText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  checkTextActive: {
    color: "#FFFFFF",
  },
  warningText: {
    color: "#FBBF24",
    fontWeight: "800",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  stopCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  stopHeader: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  stopTitle: {
    color: freightTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 5,
  },
  stopAddress: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  stopActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mapButton: {
    backgroundColor: "#334155",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
  },
  blueButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
  },
  orangeButton: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
  },
  greenButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.45,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  chatButton: {
    backgroundColor: "#10B981",
    marginHorizontal: 18,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  chatText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});