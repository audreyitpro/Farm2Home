import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";
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
  accepted_at?: string | null;
  arrived_pickup_at?: string | null;
  picked_up_at?: string | null;
  arrived_dropoff_at?: string | null;
  delivered_at?: string | null;
};

const TABLE_NAME = "freight_loads";

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

export default function FreightBoardScreen() {
  const params = useLocalSearchParams();

  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [maxMiles, setMaxMiles] = useState("150");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const createdLoadId = String(params.createdLoadId || "");

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

  const checkFreightAccess = useCallback(async () => {
    const currentFreight = await getCurrentFreightUser();

    if (!currentFreight) {
      router.replace("/freight/login" as any);
      return false;
    }

    await AsyncStorage.setItem("currentFreight", JSON.stringify(currentFreight));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(currentFreight));
    await AsyncStorage.setItem("currentUser", JSON.stringify(currentFreight));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setAccessAllowed(true);
    return true;
  }, []);

  const loadBoard = useCallback(async () => {
    try {
      const allowed = await checkFreightAccess();

      if (!allowed) {
        setLoading(false);
        setRefreshing(false);
        setAccessChecking(false);
        return;
      }

      const currentFreight = await getCurrentFreightUser();
      const currentFreightId = currentFreight?.id || "";

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .or(`status.eq.available,status.eq.accepted,carrier_id.eq.${currentFreightId}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight board error:", error.message);
        setLoads(fallbackLoads);
      } else {
        setLoads(
          Array.isArray(data) && data.length > 0
            ? (data as FreightLoad[])
            : fallbackLoads
        );
      }
    } catch (err) {
      console.log("Freight board exception:", err);
      setLoads(fallbackLoads);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setAccessChecking(false);
    }
  }, [checkFreightAccess]);

  useFocusEffect(
    useCallback(() => {
      setAccessChecking(true);
      loadBoard();
    }, [loadBoard])
  );

  useEffect(() => {
    if (createdLoadId) {
      Alert.alert("Freight Posted", "Your freight load is now live on the board.");
    }
  }, [createdLoadId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBoard();
  };

  const filteredLoads = useMemo(() => {
    const q = query.trim().toLowerCase();
    const miles = Number(maxMiles || 9999);

    return loads.filter((load) => {
      const matchesMiles = Number(load.distance_miles || 0) <= miles;

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

  const selectedTotalRate = selectedLoads.reduce(
    (sum, item) => sum + Number(item.rate || 0),
    0
  );

  const selectedTotalMiles = selectedLoads.reduce(
    (sum, item) => sum + Number(item.distance_miles || 0),
    0
  );

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
    setLoads((prev) =>
      prev.map((item) => (item.id === load.id ? { ...item, ...updates } : item))
    );

    if (!load.id.startsWith("demo")) {
      const { error } = await supabase.from(TABLE_NAME).update(updates).eq("id", load.id);

      if (error) {
        Alert.alert("Update Warning", error.message);
      }
    }
  }

  async function acceptFreightLoad(load: FreightLoad) {
    try {
      const allowed = await checkFreightAccess();
      if (!allowed) return;

      const currentFreight = await getCurrentFreightUser();

      const freightCarrierId =
        currentFreight?.id || currentFreight?.freightId || currentFreight?.email || "";

      const acceptedBy =
        currentFreight?.companyName ||
        currentFreight?.businessName ||
        currentFreight?.contactName ||
        currentFreight?.username ||
        "Farm2Home Freight Carrier";

      if (!freightCarrierId) {
        Alert.alert("Account Missing", "Please log in again.");
        return;
      }

      const updates = {
        status: "accepted" as LoadStatus,
        carrier_id: freightCarrierId,
        accepted_by: acceptedBy,
        accepted_at: new Date().toISOString(),
      };

      if (load.id.startsWith("order_")) {
        const response = await fetch(`${API_BASE_URL}/orders/${load.id}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverId: freightCarrierId,
            assignedDriverName: acceptedBy,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          Alert.alert("Accept Error", data.error || "Unable to accept load.");
          return;
        }
      } else if (!load.id.startsWith("demo")) {
        const { error } = await supabase.from(TABLE_NAME).update(updates).eq("id", load.id);

        if (error) {
          Alert.alert("Accept Error", error.message);
          return;
        }
      }

      await notifyDriverAcceptedLoad(load.id);

      Alert.alert("Load Accepted", "This freight load is now assigned to you.");
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

    const currentFreight = await getCurrentFreightUser();

    const freightCarrierId =
      currentFreight?.id || currentFreight?.freightId || currentFreight?.email || "";

    const acceptedBy =
      currentFreight?.companyName ||
      currentFreight?.businessName ||
      currentFreight?.contactName ||
      currentFreight?.username ||
      "Farm2Home Freight Carrier";

    if (!freightCarrierId) {
      Alert.alert("Account Missing", "Please log in again.");
      return;
    }

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
            batch_id: batchId,
          })
          .eq("id", load.id);

        if (error) {
          Alert.alert("Batch Error", error.message);
          return;
        }

        await notifyDriverAcceptedLoad(load.id);
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
      const allowed = await checkFreightAccess();

      if (!allowed) return;

      if (load.status === "available") {
        await acceptFreightLoad(load);
        return;
      }

      if (load.status === "accepted") {
        await saveLoadUpdates(load, {
          status: "arrived_pickup",
          arrived_pickup_at: new Date().toISOString(),
        });

        await notifyDriverArrivedPickup(load.id);
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
        await saveLoadUpdates(load, {
          status: "arrived_dropoff",
          arrived_dropoff_at: new Date().toISOString(),
        });

        await notifyDriverArrivedDropoff(load.id);
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
    } catch (err) {
      console.log("Load action error:", err);
      Alert.alert("Error", "Unable to update freight load.");
    }
  }

  async function goToPostFreight() {
    const allowed = await checkFreightAccess();
    if (!allowed) return;
    router.push("/farmer/post-load" as any);
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
      case "in_transit":
        return "Arrived Dropoff";
      case "arrived_dropoff":
        return "Proof Of Delivery";
      case "delivered":
        return "Delivered";
      default:
        return "View";
    }
  }

  if (loading || accessChecking) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1f6f43" />
        <Text style={styles.loadingText}>Checking Freight Access...</Text>
      </SafeAreaView>
    );
  }

  if (!accessAllowed) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.lockTitle}>Login Required</Text>
        <Text style={styles.loadingText}>Redirecting to freight login...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Farm2Home Freight</Text>
          <Text style={styles.title}>Live Load Board</Text>
          <Text style={styles.subtitle}>
            Select one or multiple nearby loads traveling through the same area.
          </Text>
        </View>

        <TouchableOpacity style={styles.postButton} onPress={goToPostFreight}>
          <Text style={styles.postButtonText}>Post Freight</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search freight..."
          placeholderTextColor="#7b8794"
          style={styles.searchInput}
        />

        <TextInput
          value={maxMiles}
          onChangeText={setMaxMiles}
          placeholder="Max miles willing to travel"
          placeholderTextColor="#7b8794"
          keyboardType="numeric"
          style={styles.searchInput}
        />
      </View>

      {selectedLoads.length > 0 && (
        <View style={styles.batchBar}>
          <Text style={styles.batchTitle}>
            Selected: {selectedLoads.length} loads
          </Text>

          <Text style={styles.batchText}>
            Total Rate: ${selectedTotalRate.toFixed(2)} · Total Miles:{" "}
            {selectedTotalMiles.toFixed(0)}
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
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.id);

          return (
            <View style={[styles.card, selected && styles.selectedCard]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadTitle}>{item.title}</Text>
                  <Text style={styles.farmName}>{item.farmer_name}</Text>
                </View>

                <View style={styles.rateBox}>
                  <Text style={styles.rate}>${item.rate}</Text>
                  <Text style={styles.rateLabel}>Rate</Text>
                </View>
              </View>

              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>
                  {item.status.replace(/_/g, " ")}
                </Text>
              </View>

              <View style={styles.routeContainer}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeText}>{item.pickup_location}</Text>
                <Text style={styles.routeSub}>
                  {item.pickup_date} • {item.pickup_time}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.routeLabel}>Dropoff</Text>
                <Text style={styles.routeText}>{item.dropoff_location}</Text>
                <Text style={styles.routeSub}>
                  {item.dropoff_date || "Scheduled"} • {item.dropoff_time || "TBD"}
                </Text>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Commodity</Text>
                  <Text style={styles.infoText}>{item.commodity}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Equipment</Text>
                  <Text style={styles.infoText}>{item.equipment_type}</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Weight</Text>
                  <Text style={styles.infoText}>{item.weight_lbs || 0} lbs</Text>
                </View>

                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Miles</Text>
                  <Text style={styles.infoText}>{item.distance_miles || 0}</Text>
                </View>
              </View>

              {item.status === "available" && (
                <TouchableOpacity
                  style={selected ? styles.unselectButton : styles.selectButton}
                  onPress={() => toggleSelect(item)}
                >
                  <Text style={styles.actionButtonText}>
                    {selected ? "Remove From Batch" : "Select For Batch"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  item.status === "delivered" && styles.disabledButton,
                ]}
                onPress={() => handleLoadAction(item)}
                disabled={item.status === "delivered"}
              >
                <Text style={styles.actionButtonText}>
                  {getButtonLabel(item.status)}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },
  lockTitle: {
    color: "#991B1B",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  container: { flex: 1, backgroundColor: "#f5f7f5" },
  header: {
    backgroundColor: "#163b2b",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  kicker: { color: "#9fe6b8", fontSize: 12, fontWeight: "900" },
  title: { color: "#ffffff", fontSize: 26, fontWeight: "900", marginTop: 4 },
  subtitle: { color: "#d7f5df", fontSize: 13, marginTop: 4 },
  postButton: {
    backgroundColor: "#f8c537",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  postButtonText: { fontWeight: "900", color: "#000000" },
  searchContainer: { padding: 14, gap: 10 },
  searchInput: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#dce3df",
  },
  batchBar: {
    backgroundColor: "#0F766E",
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
  },
  batchTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 17 },
  batchText: { color: "#CCFBF1", fontWeight: "800", marginTop: 5 },
  batchButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  batchAcceptButton: {
    flex: 1,
    backgroundColor: "#22C55E",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  batchClearButton: {
    backgroundColor: "#DC2626",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  batchButtonText: { color: "#FFFFFF", fontWeight: "900" },
  listContent: { paddingHorizontal: 14, paddingBottom: 50 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#dde5e0",
  },
  selectedCard: {
    borderColor: "#0F766E",
    borderWidth: 3,
    backgroundColor: "#ECFDF5",
  },
  cardTop: { flexDirection: "row", marginBottom: 12, gap: 12 },
  loadTitle: { fontSize: 18, fontWeight: "900", color: "#102417" },
  farmName: { marginTop: 4, color: "#5a6c62", fontWeight: "700" },
  rateBox: {
    backgroundColor: "#e7f7ec",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  rate: { color: "#14703b", fontWeight: "900", fontSize: 20 },
  rateLabel: { color: "#557062", fontSize: 11, fontWeight: "800" },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#1f6f43",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  statusPillText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  routeContainer: {
    backgroundColor: "#f8faf8",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e0e8e3",
    marginBottom: 12,
  },
  routeLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeText: {
    fontSize: 14,
    color: "#23352b",
    marginTop: 3,
    fontWeight: "800",
  },
  routeSub: {
    fontSize: 12,
    color: "#52625a",
    marginTop: 3,
    fontWeight: "600",
  },
  divider: { height: 1, backgroundColor: "#dce3df", marginVertical: 10 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8e4",
    borderRadius: 12,
    padding: 10,
  },
  infoLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoText: { fontSize: 13, color: "#102417", fontWeight: "800", marginTop: 4 },
  selectButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 14,
  },
  unselectButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 14,
  },
  actionButton: {
    backgroundColor: "#1f6f43",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  disabledButton: { backgroundColor: "#94a3b8" },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 14,
  },
});