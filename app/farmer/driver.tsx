import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_BASE_URL } from "../config/api";

type FarmerDriver = {
  id: string;
  farmer_id: string;
  driver_id?: string;
  driver_name: string;
  driver_email: string;
  driver_phone?: string;
  status?: string;
  invite_status?: string;
};

export default function FarmerDriversScreen() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [farmerId, setFarmerId] = useState("");

  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPhone, setDriverPhone] = useState("");

  const [drivers, setDrivers] = useState<FarmerDriver[]>([]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  async function initialize() {
    try {
      const currentFarmer =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!currentFarmer) {
        Alert.alert("Missing Farmer", "Farmer account not found.");
        return;
      }

      const parsed = JSON.parse(currentFarmer);

      if (!parsed?.id) {
        Alert.alert("Missing Farmer ID", "Please login again.");
        return;
      }

      setFarmerId(parsed.id);

      await loadDrivers(parsed.id);
    } catch (error) {
      console.log("Initialize farmer drivers error:", error);
      Alert.alert("Load Error", "Unable to load farmer driver screen.");
    }
  }

  async function loadDrivers(activeFarmerId = farmerId) {
    try {
      if (!activeFarmerId) return;

      setRefreshing(true);

      const response = await fetch(
        `${API_BASE_URL}/driver/farmer-drivers/${activeFarmerId}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load drivers.");
      }

      setDrivers(data.drivers || []);
    } catch (error: any) {
      console.log("Load farmer drivers error:", error);

      Alert.alert(
        "Load Error",
        error?.message || "Unable to load drivers."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function addDriver() {
    try {
      if (!farmerId) {
        Alert.alert("Missing Farmer", "Please login again.");
        return;
      }

      if (!driverName.trim()) {
        Alert.alert("Driver Name Required", "Please enter the driver name.");
        return;
      }

      if (!driverEmail.trim() || !driverEmail.includes("@")) {
        Alert.alert("Driver Email Required", "Please enter a valid driver email.");
        return;
      }

      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/driver/add-farmer-driver`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farmerId,
            driverName: driverName.trim(),
            driverEmail: driverEmail.trim().toLowerCase(),
            driverPhone: driverPhone.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to add driver.");
      }

      Alert.alert(
        "Driver Added",
        `${driverName.trim()} was added to your preferred drivers.`
      );

      setDriverName("");
      setDriverEmail("");
      setDriverPhone("");

      await loadDrivers(farmerId);
    } catch (error: any) {
      console.log("Add farmer driver error:", error);

      Alert.alert(
        "Add Driver Error",
        error?.message || "Unable to add driver."
      );
    } finally {
      setLoading(false);
    }
  }

  function renderDriver({ item }: { item: FarmerDriver }) {
    const isActive = item.status === "active" || !item.status;

    return (
      <View style={styles.driverCard}>
        <View style={styles.driverHeader}>
          <Text style={styles.driverName}>
            {item.driver_name}
          </Text>

          <View
            style={[
              styles.statusBadge,
              isActive ? styles.activeBadge : styles.inactiveBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                !isActive && styles.inactiveStatusText,
              ]}
            >
              {item.status || "active"}
            </Text>
          </View>
        </View>

        <Text style={styles.driverInfo}>
          {item.driver_email}
        </Text>

        {!!item.driver_phone && (
          <Text style={styles.driverInfo}>
            {item.driver_phone}
          </Text>
        )}

        {!!item.invite_status && (
          <Text style={styles.driverInfo}>
            Invite Status: {item.invite_status}
          </Text>
        )}

        <Text style={styles.driverDescription}>
          Preferred drivers receive delivery notifications first before orders
          are released to the open driver board.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={drivers}
        keyExtractor={(item) => item.id}
        renderItem={renderDriver}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDrivers(farmerId)}
          />
        }
        ListHeaderComponent={
          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          >
            <Text style={styles.header}>
              Farmer Drivers
            </Text>

            <Text style={styles.subheader}>
              Manage your preferred drivers. These drivers receive delivery
              opportunities before orders are released to the public Farm2Home
              Driver Board.
            </Text>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                Add Preferred Driver
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Driver Name"
                placeholderTextColor="#6B7280"
                value={driverName}
                onChangeText={setDriverName}
              />

              <TextInput
                style={styles.input}
                placeholder="Driver Email"
                placeholderTextColor="#6B7280"
                value={driverEmail}
                onChangeText={setDriverEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                style={styles.input}
                placeholder="Driver Phone"
                placeholderTextColor="#6B7280"
                value={driverPhone}
                onChangeText={setDriverPhone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.addButton, loading && styles.disabled]}
                onPress={addDriver}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.addButtonText}>
                    Add Driver
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>
              Preferred Drivers
            </Text>
          </ScrollView>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No preferred drivers added yet.
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7F1",
  },

  listContent: {
    padding: 20,
    paddingBottom: 120,
  },

  header: {
    fontSize: 30,
    fontWeight: "900",
    color: "#14532D",
    marginTop: 20,
  },

  subheader: {
    fontSize: 15,
    color: "#4B5563",
    marginTop: 10,
    lineHeight: 24,
    marginBottom: 25,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 16,
  },

  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
    fontWeight: "700",
  },

  addButton: {
    backgroundColor: "#15803D",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 6,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  disabled: {
    opacity: 0.6,
  },

  driverCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  driverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  driverName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
    marginRight: 10,
  },

  driverInfo: {
    color: "#4B5563",
    marginTop: 6,
    fontWeight: "700",
  },

  driverDescription: {
    color: "#6B7280",
    marginTop: 12,
    lineHeight: 22,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },

  activeBadge: {
    backgroundColor: "#DCFCE7",
  },

  inactiveBadge: {
    backgroundColor: "#FEE2E2",
  },

  statusText: {
    fontWeight: "900",
    color: "#166534",
  },

  inactiveStatusText: {
    color: "#991B1B",
  },

  emptyContainer: {
    marginTop: 40,
    alignItems: "center",
  },

  emptyText: {
    color: "#6B7280",
    fontWeight: "700",
  },
});