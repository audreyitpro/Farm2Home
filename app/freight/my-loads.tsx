import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import {
  FreightLoad,
  FreightLoadStatus,
  getCarrierLoads,
  updateFreightLoadStatus,
} from "../data/freightLoadStore";

import freightTheme from "../styles/freightTheme";

type StoredCarrier = {
  id?: string;
  email?: string;
  companyName?: string;
  name?: string;
  ownerName?: string;
};

function safelyParseCarrier(rawValue: string | null): StoredCarrier | null {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.log("Carrier parse error:", error);
    return null;
  }
}

export default function MyFreightLoads() {
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [carrierId, setCarrierId] = useState("demo_carrier_1");
  const [carrierName, setCarrierName] = useState("Freight Connect Carrier");

  useFocusEffect(
    useCallback(() => {
      loadMyLoads();
    }, [])
  );

  async function loadMyLoads() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight"));

      const carrier = safelyParseCarrier(saved);

      const id = carrier?.id || carrier?.email || "demo_carrier_1";
      const name =
        carrier?.companyName ||
        carrier?.name ||
        carrier?.ownerName ||
        "Freight Connect Carrier";

      setCarrierId(id);
      setCarrierName(name);

      const carrierLoads = await getCarrierLoads(id);
      setLoads(carrierLoads);
    } catch (error) {
      console.log("Load my freight loads error:", error);
      Alert.alert("Load Error", "Unable to load your freight loads.");
    }
  }

  async function updateLoad(loadId: string, status: FreightLoadStatus) {
    try {
      await updateFreightLoadStatus(loadId, status, carrierName, carrierId);
      await loadMyLoads();

      Alert.alert("Load Updated", `Load marked as ${status}.`);
    } catch (error) {
      console.log("Update freight load error:", error);
      Alert.alert("Update Error", "Unable to update this load.");
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "ACCEPTED":
        return "#00C2FF";
      case "PICKED_UP":
        return "#F59E0B";
      case "IN_TRANSIT":
        return "#A855F7";
      case "DELIVERED":
        return "#14B8A6";
      case "CANCELLED":
        return "#DC2626";
      default:
        return "#64748B";
    }
  }

  function renderActions(load: FreightLoad) {
    if (load.status === "ACCEPTED") {
      return (
        <TouchableOpacity
          style={styles.pickupButton}
          onPress={() => updateLoad(load.id, "PICKED_UP")}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>Mark Picked Up</Text>
        </TouchableOpacity>
      );
    }

    if (load.status === "PICKED_UP") {
      return (
        <TouchableOpacity
          style={styles.transitButton}
          onPress={() => updateLoad(load.id, "IN_TRANSIT")}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>Start Delivery</Text>
        </TouchableOpacity>
      );
    }

    if (load.status === "IN_TRANSIT") {
      return (
        <TouchableOpacity
          style={styles.deliveredButton}
          onPress={() => updateLoad(load.id, "DELIVERED")}
          activeOpacity={0.85}
        >
          <Text style={styles.actionText}>Mark Delivered</Text>
        </TouchableOpacity>
      );
    }

    if (load.status === "DELIVERED") {
      return (
        <View style={styles.completeBadge}>
          <Text style={styles.completeText}>Completed</Text>
        </View>
      );
    }

    return (
      <View style={styles.inactiveBadge}>
        <Text style={styles.inactiveText}>{load.status}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Loads</Text>

      <Text style={styles.subtitle}>
        {carrierName} · Manage your accepted Farm2Home deliveries.
      </Text>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.boardButton}
          onPress={() => router.push("/freight/board" as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.boardText}>Back to Load Board</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.routeButton}
          onPress={() => router.push("/freight/live-route" as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.routeButtonText}>Live Route</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No claimed loads yet.</Text>
            <Text style={styles.emptyText}>
              Claim a delivery from the freight board to manage it here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.loadId}>Load #{item.id.slice(-6)}</Text>

              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: statusColor(item.status),
                  },
                ]}
              >
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            <Text style={styles.route}>{item.pickupLocation}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.route}>{item.dropoffLocation}</Text>

            <View style={styles.detailsBox}>
              <Text style={styles.detail}>Type: {item.loadType}</Text>
              <Text style={styles.detail}>Pickup: {item.pickupDate}</Text>
              <Text style={styles.detail}>
                Deadline: {item.deliveryDeadline}
              </Text>
              <Text style={styles.detail}>Posted By: {item.farmerName}</Text>
            </View>

            <Text style={styles.description}>{item.description}</Text>

            <View style={styles.footerRow}>
              <View style={styles.payoutBlock}>
                <Text style={styles.rateLabel}>Payout</Text>
                <Text style={styles.payout}>
                  ${Number(item.payoutAmount || 0).toFixed(2)}
                </Text>
              </View>

              {renderActions(item)}
            </View>
          </View>
        )}
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

  boardButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  boardText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  routeButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  routeButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },

  listContent: {
    paddingBottom: 80,
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
    flex: 1,
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

  detailsBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    marginBottom: 14,
  },

  detail: {
    color: freightTheme.colors.text,
    fontWeight: "700",
    marginBottom: 6,
  },

  description: {
    color: "#CBD5E1",
    lineHeight: 22,
    marginBottom: 16,
  },

  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  payoutBlock: {
    flex: 1,
  },

  rateLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
    marginBottom: 4,
  },

  payout: {
    color: freightTheme.colors.success,
    fontSize: 28,
    fontWeight: "900",
  },

  pickupButton: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },

  transitButton: {
    backgroundColor: "#A855F7",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },

  deliveredButton: {
    backgroundColor: "#14B8A6",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },

  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  completeBadge: {
    backgroundColor: "#14B8A6",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },

  completeText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  inactiveBadge: {
    backgroundColor: "#64748B",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
  },

  inactiveText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});