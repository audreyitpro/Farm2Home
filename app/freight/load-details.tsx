// app/freight/load-details.tsx

import React, { useCallback, useMemo, useState } from "react";
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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";
import freightTheme from "../styles/freightTheme";
import {
  notifyDriverAcceptedLoad,
  notifyDriverArrivedPickup,
  notifyDriverArrivedDropoff,
} from "../services/notificationService";

type LoadStatus =
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
  title?: string;
  farmer_name?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_date?: string;
  pickup_time?: string;
  dropoff_date?: string | null;
  dropoff_time?: string | null;
  equipment_type?: string;
  weight_lbs?: number | null;
  temperature_required?: string | null;
  rate?: number;
  distance_miles?: number | null;
  commodity?: string;
  notes?: string | null;
  status?: LoadStatus;
  carrier_id?: string | null;
  driver_id?: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  arrived_pickup_at?: string | null;
  picked_up_at?: string | null;
  arrived_dropoff_at?: string | null;
  delivered_at?: string | null;
  created_at?: string;
};

const TABLE_NAME = "freight_loads";

export default function FreightLoadDetailsScreen() {
  const params = useLocalSearchParams();
  const loadId = Array.isArray(params.loadId)
    ? params.loadId[0] || ""
    : String(params.loadId || "");

  const [loading, setLoading] = useState(true);
  const [load, setLoad] = useState<FreightLoad | null>(null);
  const [carrier, setCarrier] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadDetails();
    }, [loadId])
  );

  const ratePerMile = useMemo(() => {
    const rate = Number(load?.rate || 0);
    const miles = Number(load?.distance_miles || 0);
    return miles > 0 ? rate / miles : 0;
  }, [load]);

  async function getCurrentFreightUser() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      return {
        ...parsed,
        id: parsed.id || parsed.freightId || parsed.email,
        freightId: parsed.freightId || parsed.id || parsed.email,
        role: "freight",
        accountActive: parsed.accountActive !== false,
        membershipStatus: parsed.membershipStatus || "Active",
        subscriptionStatus: parsed.subscriptionStatus || "active",
      };
    } catch {
      return null;
    }
  }

  async function loadDetails() {
    try {
      setLoading(true);

      const currentCarrier = await getCurrentFreightUser();

      if (!currentCarrier) {
        router.replace("/freight/login" as any);
        return;
      }

      setCarrier(currentCarrier);

      if (!loadId) {
        Alert.alert("Missing Load", "No freight load was selected.");
        router.replace("/freight/board" as any);
        return;
      }

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("id", loadId)
        .maybeSingle();

      if (error) {
        Alert.alert("Load Error", error.message);
        return;
      }

      if (!data) {
        Alert.alert("Not Found", "This freight load was not found.");
        router.replace("/freight/board" as any);
        return;
      }

      setLoad(data as FreightLoad);
    } catch (error: any) {
      console.log("Freight load details error:", error);
      Alert.alert("Load Error", error?.message || "Unable to load details.");
    } finally {
      setLoading(false);
    }
  }

  async function updateLoad(updates: Partial<FreightLoad>) {
    if (!load?.id) return;

    setLoad((prev) => (prev ? { ...prev, ...updates } : prev));

    const { error } = await supabase
      .from(TABLE_NAME)
      .update(updates)
      .eq("id", load.id);

    if (error) {
      Alert.alert("Update Error", error.message);
      await loadDetails();
    }
  }

  async function acceptLoad() {
    if (!load) return;

    const carrierId = carrier?.id || carrier?.freightId || carrier?.email || "";
    const acceptedBy =
      carrier?.companyName ||
      carrier?.businessName ||
      carrier?.contactName ||
      carrier?.username ||
      "Farm2Home Freight Carrier";

    if (!carrierId) {
      Alert.alert("Account Missing", "Please log in again.");
      return;
    }

    const updates = {
      status: "accepted" as LoadStatus,
      carrier_id: carrierId,
      accepted_by: acceptedBy,
      accepted_at: new Date().toISOString(),
    };

    await updateLoad(updates);
    await notifyDriverAcceptedLoad();

    Alert.alert("Load Accepted", "This freight load is now assigned to you.");
  }

  async function markArrivedPickup() {
    if (!load) return;

    await updateLoad({
      status: "arrived_pickup",
      arrived_pickup_at: new Date().toISOString(),
    });

    await notifyDriverArrivedPickup();
  }

  async function markArrivedDropoff() {
    if (!load) return;

    await updateLoad({
      status: "arrived_dropoff",
      arrived_dropoff_at: new Date().toISOString(),
    });

    await notifyDriverArrivedDropoff();
  }

  function getActionLabel(status?: LoadStatus) {
    switch (status) {
      case "available":
        return "Accept Load";
      case "accepted":
        return "Arrived Pickup";
      case "arrived_pickup":
        return "Proof Of Pickup";
      case "picked_up":
      case "in_transit":
        return "Arrived Dropoff";
      case "arrived_dropoff":
        return "Proof Of Delivery";
      case "delivered":
        return "Delivered";
      case "cancelled":
        return "Cancelled";
      default:
        return "View Load";
    }
  }

  async function handlePrimaryAction() {
    if (!load) return;

    if (load.status === "available") {
      await acceptLoad();
      return;
    }

    if (load.status === "accepted") {
      await markArrivedPickup();
      return;
    }

    if (load.status === "arrived_pickup") {
      router.push({
        pathname: "/driver/proof-of-pickup",
        params: { loadId: load.id },
      } as any);
      return;
    }

    if (load.status === "picked_up" || load.status === "in_transit") {
      await markArrivedDropoff();
      return;
    }

    if (load.status === "arrived_dropoff") {
      router.push({
        pathname: "/driver/proof-of-delivery",
        params: { loadId: load.id },
      } as any);
      return;
    }

    if (load.status === "delivered") {
      Alert.alert("Delivered", "This freight load has already been completed.");
    }
  }

  function statusColor(status?: LoadStatus) {
    switch (status) {
      case "available":
        return "#2563EB";
      case "accepted":
        return freightTheme.colors.primary;
      case "arrived_pickup":
        return "#0EA5E9";
      case "picked_up":
        return "#F59E0B";
      case "in_transit":
        return "#7C3AED";
      case "arrived_dropoff":
        return "#0F766E";
      case "delivered":
        return "#10B981";
      case "cancelled":
        return "#DC2626";
      default:
        return "#64748B";
    }
  }

  function statusIcon(status?: LoadStatus): keyof typeof Ionicons.glyphMap {
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
        return "checkmark-done-outline";
      case "cancelled":
        return "close-circle-outline";
      default:
        return "ellipse-outline";
    }
  }

  function formatStatus(status?: string) {
    return String(status || "unknown")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatMoney(value?: number | null) {
    return `$${Number(value || 0).toFixed(2)}`;
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
        <Ionicons name={icon} size={18} color="#10B981" />
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading load details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!load) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.loadingScreen}>
          <Text style={styles.emptyTitle}>Load not found.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/freight/board" as any)}
          >
            <Text style={styles.primaryButtonText}>Back to Board</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
              <Text style={styles.title}>Load Details</Text>
              <Text style={styles.subtitle}>
                Review route, payout, freight requirements, and delivery workflow.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="document-text-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/freight/board" as any)}
          >
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Board</Text>
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

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.loadTitle}>{load.title || "Farm2Home Freight Load"}</Text>
              <Text style={styles.farmName}>
                Posted by {load.farmer_name || "Farm2Home Partner"}
              </Text>
            </View>

            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusColor(load.status) },
              ]}
            >
              <Ionicons name={statusIcon(load.status)} size={14} color="#FFFFFF" />
              <Text style={styles.statusText}>{formatStatus(load.status)}</Text>
            </View>
          </View>

          <View style={styles.routeBox}>
            <View style={styles.routeStop}>
              <Ionicons name="radio-button-on" size={18} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeText}>
                  {load.pickup_location || "Pickup location"}
                </Text>
                <Text style={styles.routeSub}>
                  {load.pickup_date || "Scheduled"} • {load.pickup_time || "TBD"}
                </Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routeStop}>
              <Ionicons name="location" size={18} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>Dropoff</Text>
                <Text style={styles.routeText}>
                  {load.dropoff_location || "Dropoff location"}
                </Text>
                <Text style={styles.routeSub}>
                  {load.dropoff_date || "Scheduled"} • {load.dropoff_time || "TBD"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.payoutCard}>
            <View>
              <Text style={styles.payoutLabel}>Carrier Payout</Text>
              <Text style={styles.payoutValue}>{formatMoney(load.rate)}</Text>
            </View>

            <View style={styles.rateMiniBox}>
              <Text style={styles.rateMiniLabel}>Rate / Mile</Text>
              <Text style={styles.rateMiniValue}>${ratePerMile.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Freight Requirements</Text>

          <View style={styles.detailGrid}>
            <DetailBox
              icon="leaf-outline"
              label="Commodity"
              value={load.commodity || "Not listed"}
            />

            <DetailBox
              icon="car-outline"
              label="Equipment"
              value={load.equipment_type || "Not listed"}
            />

            <DetailBox
              icon="scale-outline"
              label="Weight"
              value={`${Number(load.weight_lbs || 0).toLocaleString()} lbs`}
            />

            <DetailBox
              icon="speedometer-outline"
              label="Miles"
              value={`${Number(load.distance_miles || 0).toFixed(0)} mi`}
            />

            <DetailBox
              icon="thermometer-outline"
              label="Temperature"
              value={load.temperature_required || "Not required"}
            />

            <DetailBox
              icon="person-outline"
              label="Accepted By"
              value={load.accepted_by || "Not accepted yet"}
            />
          </View>
        </View>

        {!!load.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{load.notes}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Load Workflow</Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              load.status === "delivered" && styles.disabledButton,
            ]}
            onPress={handlePrimaryAction}
            disabled={load.status === "delivered"}
          >
            <Ionicons name={statusIcon(load.status)} size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>
              {getActionLabel(load.status)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.push({
                pathname: "/freight/live-route",
                params: { loadId: load.id, title: load.title || "" },
              } as any)
            }
          >
            <Ionicons
              name="map-outline"
              size={18}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.secondaryButtonText}>Open Live Route</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-pickup",
                params: { loadId: load.id },
              } as any)
            }
          >
            <Ionicons
              name="camera-outline"
              size={18}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.secondaryButtonText}>Proof Of Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-delivery",
                params: { loadId: load.id },
              } as any)
            }
          >
            <Ionicons
              name="checkmark-done-outline"
              size={18}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.secondaryButtonText}>Proof Of Delivery</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 90,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 10,
    fontWeight: "800",
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
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
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
  card: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  loadTitle: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  farmName: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 150,
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
    alignItems: "center",
    gap: 10,
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
  routeText: {
    color: freightTheme.colors.text,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 3,
  },
  routeSub: {
    color: freightTheme.colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  payoutCard: {
    backgroundColor: "#064E3B",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  payoutLabel: {
    color: "#BBF7D0",
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  payoutValue: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },
  rateMiniBox: {
    backgroundColor: "#052E2B",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  rateMiniLabel: {
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: "900",
  },
  rateMiniValue: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
    marginTop: 3,
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailBox: {
    width: "48%",
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    padding: 12,
  },
  detailLabel: {
    color: freightTheme.colors.mutedText,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 6,
  },
  detailValue: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    marginTop: 4,
    lineHeight: 19,
  },
  notesText: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: freightTheme.colors.primary,
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  disabledButton: {
    backgroundColor: "#64748B",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },
});