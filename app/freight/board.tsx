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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "../services/supabaseClient";
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

export default function FreightBoardScreen() {
  const params = useLocalSearchParams();

  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const createdLoadId = String(params.createdLoadId || "");

  const loadBoard = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
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
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
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

    return loads.filter((load) => {
      if (!q) return true;

      return (
        load.title?.toLowerCase().includes(q) ||
        load.pickup_location?.toLowerCase().includes(q) ||
        load.dropoff_location?.toLowerCase().includes(q) ||
        load.farmer_name?.toLowerCase().includes(q) ||
        load.commodity?.toLowerCase().includes(q) ||
        load.equipment_type?.toLowerCase().includes(q)
      );
    });
  }, [loads, query]);

  async function saveLoadUpdates(load: FreightLoad, updates: Partial<FreightLoad>) {
    setLoads((prev) =>
      prev.map((item) => (item.id === load.id ? { ...item, ...updates } : item))
    );

    if (!load.id.startsWith("demo")) {
      const { error } = await supabase
        .from(TABLE_NAME)
        .update(updates)
        .eq("id", load.id);

      if (error) {
        Alert.alert("Update Warning", error.message);
      }
    }
  }

async function handleLoadAction(load: FreightLoad) {
  try {
    if (load.status === "available") {
      await saveLoadUpdates(load, {
        status: "accepted",
        accepted_at: new Date().toISOString(),
      });

      await notifyDriverAcceptedLoad(load.id);

      router.push({
        pathname: "/driver/live-location-provider" as any,
        params: { loadId: load.id },
      });

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
        pathname: "/driver/proof-of-pickup" as any,
        params: { loadId: load.id },
      });

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
        pathname: "/driver/proof-of-delivery" as any,
        params: { loadId: load.id },
      });

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

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1f6f43" />
        <Text style={styles.loadingText}>Loading Freight Board...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Farm2Home Freight</Text>
          <Text style={styles.title}>Live Load Board</Text>
          <Text style={styles.subtitle}>Accept, track, and complete deliveries.</Text>
        </View>

        <TouchableOpacity
          style={styles.postButton}
          onPress={() =>
            router.push({
              pathname: "/farmer/post-load" as any,
            })
          }
        >
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
      </View>

      <FlatList
        data={filteredLoads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
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

            <TouchableOpacity
              style={[
                styles.actionButton,
                item.status === "delivered" && styles.disabledButton,
              ]}
              onPress={() => handleLoadAction(item)}
              disabled={item.status === "delivered"}
            >
              <Text style={styles.actionButtonText}>{getButtonLabel(item.status)}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 16, fontWeight: "700" },
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
  searchContainer: { padding: 14 },
  searchInput: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#dce3df",
  },
  listContent: { paddingHorizontal: 14, paddingBottom: 50 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#dde5e0",
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
  routeText: { fontSize: 14, color: "#23352b", marginTop: 3, fontWeight: "800" },
  routeSub: { fontSize: 12, color: "#52625a", marginTop: 3, fontWeight: "600" },
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
  actionButton: {
    backgroundColor: "#1f6f43",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 14,
  },
  disabledButton: { backgroundColor: "#94a3b8" },
  actionButtonText: { color: "#ffffff", fontWeight: "900", fontSize: 14 },
});