// app/admin/farm2grow.tsx

import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import {
  Farmer,
  getFarmers,
  toggleFarmerApproval,
} from "../data/farmerStore";

export default function AdminFarm2Grow() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadFarmers();
    }, [])
  );

  async function loadFarmers() {
    try {
      const data = await getFarmers();
      setFarmers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("Load farmers error:", error);
      setFarmers([]);
    }
  }

  async function handleToggleApproval(id: string) {
    try {
      const updatedFarmers = await toggleFarmerApproval(id);
      setFarmers(Array.isArray(updatedFarmers) ? updatedFarmers : []);

      Alert.alert("Updated", "Farmer approval status changed.");
    } catch (error) {
      console.log("Toggle farmer approval error:", error);
      Alert.alert("Error", "Unable to update farmer approval status.");
    }
  }

  function getFarmName(item: Farmer) {
    return (
      (item as any).farmName ||
      (item as any).farm_name ||
      (item as any).businessName ||
      "Unnamed Farm"
    );
  }

  function getOwnerName(item: Farmer) {
    return (
      (item as any).ownerName ||
      (item as any).owner_name ||
      (item as any).contactName ||
      "Unknown Owner"
    );
  }

  function getProductsCount(item: Farmer) {
    const products = (item as any).products;
    return Array.isArray(products) ? products.length : 0;
  }

  function getRevenue(item: Farmer) {
    return Number((item as any).revenue || 0);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Farm2Grow Admin</Text>

      <Text style={styles.subtitle}>
        Approve farmers to make them visible in Marketplace.
      </Text>

      <FlatList
        data={farmers}
        keyExtractor={(item, index) => String((item as any).id || index)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No farmers found.</Text>
            <Text style={styles.emptyText}>
              Registered farmers will appear here for approval.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const approved = Boolean((item as any).approved);

          return (
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.infoBlock}>
                  <Text style={styles.farmName}>{getFarmName(item)}</Text>

                  <Text style={styles.detailText}>
                    Owner: {getOwnerName(item)}
                  </Text>

                  <Text style={styles.detailText}>
                    Status: {approved ? "Approved" : "Pending"}
                  </Text>

                  <Text style={styles.detailText}>
                    Pickup: {(item as any).pickup ? "Yes" : "No"}
                  </Text>

                  <Text style={styles.detailText}>
                    Delivery: {(item as any).delivery ? "Yes" : "No"}
                  </Text>

                  <Text style={styles.detailText}>
                    Products: {getProductsCount(item)}
                  </Text>

                  <Text style={styles.detailText}>
                    Reviews: {Number((item as any).reviews || 0)}
                  </Text>

                  <Text style={styles.detailText}>
                    Items Sold: {Number((item as any).itemsSold || 0)}
                  </Text>

                  <Text style={styles.detailText}>
                    Total Revenue: ${getRevenue(item).toFixed(2)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    approved ? styles.approvedBadge : styles.pendingBadge,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {approved ? "LIVE" : "WAITING"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  approved ? styles.removeButton : styles.approveButton,
                ]}
                onPress={() => handleToggleApproval(String((item as any).id))}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>
                  {approved ? "Remove from Marketplace" : "Approve Farmer"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <TouchableOpacity
        style={styles.marketButton}
        onPress={() => router.push("/customer/marketplace" as never)}
        activeOpacity={0.85}
      >
        <Text style={styles.marketButtonText}>View Marketplace</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: "#F7F7F2",
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1f7a3f",
  },

  subtitle: {
    color: "#666666",
    marginBottom: 18,
    fontWeight: "700",
    lineHeight: 21,
  },

  listContent: {
    paddingBottom: 100,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },

  emptyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },

  emptyText: {
    color: "#666666",
    fontWeight: "700",
    lineHeight: 21,
  },

  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#DDDDDD",
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  infoBlock: {
    flex: 1,
  },

  farmName: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    color: "#111827",
  },

  detailText: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 3,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },

  approvedBadge: {
    backgroundColor: "#2F7D32",
  },

  pendingBadge: {
    backgroundColor: "#C96A00",
  },

  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },

  button: {
    padding: 13,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },

  approveButton: {
    backgroundColor: "#2F7D32",
  },

  removeButton: {
    backgroundColor: "#CC0000",
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  marketButton: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    backgroundColor: "#1E5F74",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },

  marketButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});