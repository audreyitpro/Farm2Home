import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import {
  getTrackingForLoad,
  updateTracking,
  TrackingRecord,
  TrackingStatus,
} from "./data/trackingStore";

const statuses: TrackingStatus[] = [
  "Assigned",
  "Driver En Route",
  "Arrived at Pickup",
  "Loaded",
  "In Transit",
  "Arrived at Dropoff",
  "Delivered",
];

export default function FreightTracking() {
  const params = useLocalSearchParams();

  const loadId = Array.isArray(params.loadId)
    ? params.loadId[0]
    : params.loadId || "";

  const [tracking, setTracking] = useState<TrackingRecord | null>(null);

  const loadTracking = useCallback(async () => {
    if (!loadId) return;

    const trackingData = await getTrackingForLoad(String(loadId));
    setTracking(trackingData);
  }, [loadId]);

  useEffect(() => {
    loadTracking();
  }, [loadTracking]);

  async function setStatus(status: TrackingStatus) {
    if (!loadId) return;

    await updateTracking(String(loadId), status);

    Alert.alert("Tracking Updated", `Status changed to ${status}`);

    loadTracking();
  }

  if (!tracking) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Live Tracking</Text>
        <Text style={styles.emptyText}>
          No carrier assigned yet. Accept a bid first.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Live Tracking</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Carrier</Text>
        <Text style={styles.value}>{tracking.carrierCompany}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.valueSmall}>{tracking.carrierEmail}</Text>

        <Text style={styles.label}>Current Status</Text>
        <Text style={styles.status}>{tracking.status}</Text>

        <Text style={styles.label}>Last Updated</Text>
        <Text style={styles.valueSmall}>{tracking.lastUpdated}</Text>
      </View>

      <Text style={styles.section}>Update Status</Text>

      {statuses.map((status) => {
        const active = tracking.status === status;

        return (
          <TouchableOpacity
            key={status}
            style={[styles.statusButton, active && styles.statusButtonActive]}
            onPress={() => setStatus(status)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.statusButtonText,
                active && styles.statusButtonTextActive,
              ]}
            >
              {status}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1f7a3f",
    marginBottom: 16,
  },
  emptyText: {
    color: "#333",
    fontWeight: "700",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  label: {
    marginTop: 10,
    fontWeight: "900",
    color: "#333",
  },
  value: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  valueSmall: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },
  status: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1f7a3f",
  },
  section: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
    color: "#111827",
  },
  statusButton: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  statusButtonActive: {
    backgroundColor: "#2F7D32",
    borderColor: "#2F7D32",
  },
  statusButtonText: {
    textAlign: "center",
    fontWeight: "900",
    color: "#333",
  },
  statusButtonTextActive: {
    color: "#fff",
  },
});