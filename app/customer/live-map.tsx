import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { supabase } from "../services/supabaseClient";

type FreightLoad = {
  id: string;
  title?: string | null;
  farmer_name?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  dropoff_date?: string | null;
  dropoff_time?: string | null;
  commodity?: string | null;
  rate?: number | null;
  distance_miles?: number | null;
  status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  picked_up_at?: string | null;
  delivered_at?: string | null;
  proof_of_delivery_photo_url?: string | null;
};

type DriverLocation = {
  id?: string;
  load_id: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  updated_at?: string | null;
  status?: string | null;
};

export default function CustomerLiveMap() {
  const params = useLocalSearchParams();

  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId || "";

  const loadId = Array.isArray(params.loadId)
    ? params.loadId[0]
    : params.loadId || "";

  const resolvedLoadId = loadId || orderId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [load, setLoad] = useState<FreightLoad | null>(null);
  const [driverLocation, setDriverLocation] =
    useState<DriverLocation | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadTracking();

      const channel = supabase
        .channel(`customer-live-map-${resolvedLoadId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "freight_loads",
          },
          () => loadTracking()
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "driver_locations",
          },
          () => loadTracking()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [resolvedLoadId])
  );

  async function loadTracking() {
    try {
      setLoading(true);

      if (!resolvedLoadId) {
        setLoad(null);
        setDriverLocation(null);
        return;
      }

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("id", resolvedLoadId)
        .single();

      if (loadError) {
        console.log("LOAD_TRACKING_ERROR:", loadError.message);
        setLoad(null);
        return;
      }

      const { data: locationData, error: locationError } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("load_id", resolvedLoadId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (locationError) {
        console.log("LOCATION_TRACKING_ERROR:", locationError.message);
      }

      setLoad(loadData || null);

      if (locationData) {
        setDriverLocation({
          ...locationData,
          latitude: Number(locationData.latitude || 0),
          longitude: Number(locationData.longitude || 0),
        });
      } else {
        setDriverLocation(null);
      }
    } catch (error) {
      console.log("CUSTOMER_TRACKING_CRASH:", error);
      setLoad(null);
      setDriverLocation(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadTracking();
  }

  function readableStatus(status?: string | null) {
    return String(status || "waiting_for_driver").replace(/_/g, " ");
  }

  function statusColor(status?: string | null) {
    switch (status) {
      case "available":
        return "#2563EB";
      case "accepted":
        return "#7C3AED";
      case "arrived_pickup":
        return "#0891B2";
      case "picked_up":
        return "#F59E0B";
      case "in_transit":
        return "#0F766E";
      case "arrived_dropoff":
        return "#14B8A6";
      case "delivered":
        return "#10B981";
      case "cancelled":
        return "#DC2626";
      default:
        return "#64748B";
    }
  }

  const estimatedEta = useMemo(() => {
    if (!load) return "Calculating";

    switch (load.status) {
      case "available":
        return "Waiting for driver";
      case "accepted":
        return "Driver heading to pickup";
      case "arrived_pickup":
        return "Pickup starting";
      case "picked_up":
      case "in_transit":
        return "45 - 90 mins";
      case "arrived_dropoff":
        return "Driver arriving now";
      case "delivered":
        return "Delivered";
      default:
        return "Calculating";
    }
  }, [load]);

  if (loading && !load) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading live tracking...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.webMapFallback}>
        <Text style={styles.webIcon}>🗺️</Text>

        <Text style={styles.webTitle}>Live Delivery Tracking</Text>

        <Text style={styles.webText}>
          Realtime GPS tracking, freight status updates, and delivery proof are
          connected to the Farm2Home logistics platform.
        </Text>

        {driverLocation ? (
          <>
            <Text style={styles.webGps}>
              GPS: {driverLocation.latitude.toFixed(5)},{" "}
              {driverLocation.longitude.toFixed(5)}
            </Text>

            <Text style={styles.webGps}>
              Driver Status: {readableStatus(driverLocation.status)}
            </Text>
          </>
        ) : (
          <Text style={styles.webGps}>
            Waiting for driver GPS updates...
          </Text>
        )}
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Customer Live Tracking</Text>

        {load ? (
          <>
            <View style={styles.statusCard}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusColor(load.status),
                  },
                ]}
              >
                <Text style={styles.statusText}>
                  {readableStatus(load.status)}
                </Text>
              </View>

              <Text style={styles.statusTitle}>
                {load.title || "Farm2Home Delivery"}
              </Text>

              <Text style={styles.detail}>
                Farmer: {load.farmer_name || "Farm2Home Farmer"}
              </Text>

              <Text style={styles.detail}>
                Commodity: {load.commodity || "Farm Goods"}
              </Text>

              <Text style={styles.detail}>
                Pickup: {load.pickup_location || "Pending"}
              </Text>

              <Text style={styles.detail}>
                Dropoff: {load.dropoff_location || "Pending"}
              </Text>

              <Text style={styles.detail}>
                ETA: {estimatedEta}
              </Text>
            </View>

            <View style={styles.timelineCard}>
              <Text style={styles.timelineTitle}>Delivery Timeline</Text>

              <View style={styles.timelineItem}>
                <Text style={styles.timelineDot}>●</Text>

                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel}>Load Created</Text>

                  <Text style={styles.timelineTime}>
                    {load.created_at
                      ? new Date(load.created_at).toLocaleString()
                      : "Pending"}
                  </Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <Text style={styles.timelineDot}>●</Text>

                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel}>Driver Accepted</Text>

                  <Text style={styles.timelineTime}>
                    {load.accepted_at
                      ? new Date(load.accepted_at).toLocaleString()
                      : "Waiting"}
                  </Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <Text style={styles.timelineDot}>●</Text>

                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel}>Pickup Completed</Text>

                  <Text style={styles.timelineTime}>
                    {load.picked_up_at
                      ? new Date(load.picked_up_at).toLocaleString()
                      : "Waiting"}
                  </Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <Text style={styles.timelineDot}>●</Text>

                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel}>Delivered</Text>

                  <Text style={styles.timelineTime}>
                    {load.delivered_at
                      ? new Date(load.delivered_at).toLocaleString()
                      : "In Progress"}
                  </Text>
                </View>
              </View>
            </View>

            {driverLocation ? (
              <View style={styles.gpsCard}>
                <Text style={styles.sectionTitle}>Driver GPS</Text>

                <Text style={styles.detail}>
                  Latitude: {driverLocation.latitude.toFixed(5)}
                </Text>

                <Text style={styles.detail}>
                  Longitude: {driverLocation.longitude.toFixed(5)}
                </Text>

                <Text style={styles.detail}>
                  Speed:{" "}
                  {driverLocation.speed !== null &&
                  driverLocation.speed !== undefined
                    ? `${Number(driverLocation.speed).toFixed(1)} m/s`
                    : "Unavailable"}
                </Text>

                <Text style={styles.detail}>
                  Last Update:{" "}
                  {driverLocation.updated_at
                    ? new Date(driverLocation.updated_at).toLocaleString()
                    : "Unknown"}
                </Text>
              </View>
            ) : (
              <View style={styles.warningCard}>
                <Text style={styles.warningText}>
                  Driver GPS will appear once the route begins.
                </Text>
              </View>
            )}

            {load.proof_of_delivery_photo_url ? (
              <View style={styles.photoCard}>
                <Text style={styles.sectionTitle}>
                  Proof of Delivery
                </Text>

                <Image
                  source={{
                    uri: load.proof_of_delivery_photo_url,
                  }}
                  style={styles.deliveryPhoto}
                />
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              No active load tracking found.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadTracking}
        >
          <Text style={styles.refreshText}>Refresh Tracking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F7F7F2",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#374151",
    fontWeight: "800",
    marginTop: 10,
  },
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  webMapFallback: {
    height: "34%",
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  webIcon: {
    fontSize: 56,
    marginBottom: 10,
  },
  webTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#064E3B",
    marginBottom: 8,
    textAlign: "center",
  },
  webText: {
    color: "#374151",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 23,
    maxWidth: 420,
  },
  webGps: {
    color: "#10B981",
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  panel: {
    flex: 1,
    backgroundColor: "#F7F7F2",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    padding: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#064E3B",
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 12,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    textTransform: "capitalize",
  },
  statusTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },
  detail: {
    color: "#374151",
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 4,
  },
  timelineCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  timelineTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },
  timelineItem: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  timelineDot: {
    color: "#10B981",
    fontSize: 18,
    marginTop: 1,
  },
  timelineLabel: {
    color: "#111827",
    fontWeight: "900",
  },
  timelineTime: {
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "700",
  },
  gpsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 12,
  },
  warningCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FDBA74",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  warningText: {
    color: "#9A3412",
    fontWeight: "800",
    lineHeight: 22,
  },
  photoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  deliveryPhoto: {
    width: "100%",
    height: 260,
    borderRadius: 18,
  },
  refreshButton: {
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  backButton: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});