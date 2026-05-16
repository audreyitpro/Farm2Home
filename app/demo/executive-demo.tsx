import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

type DemoTruck = {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  status: string;
  load: string;
};

type DemoAlert = {
  id: string;
  title: string;
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

const DEMO_TRUCKS: DemoTruck[] = [
  {
    id: "truck_1",
    name: "ASO Carrier 101",
    city: "Detroit",
    state: "MI",
    latitude: 42.3314,
    longitude: -83.0458,
    status: "EN_ROUTE_TO_PICKUP",
    load: "Cold-chain dairy pickup",
  },
  {
    id: "truck_2",
    name: "Fresh Route 204",
    city: "Ann Arbor",
    state: "MI",
    latitude: 42.2808,
    longitude: -83.743,
    status: "IN_TRANSIT",
    load: "Organic produce delivery",
  },
  {
    id: "truck_3",
    name: "FarmLink 318",
    city: "Lansing",
    state: "MI",
    latitude: 42.7325,
    longitude: -84.5555,
    status: "PICKED_UP",
    load: "Eggs and honey",
  },
  {
    id: "truck_4",
    name: "Blue Water 712",
    city: "Toledo",
    state: "OH",
    latitude: 41.6528,
    longitude: -83.5379,
    status: "EN_ROUTE_TO_DROPOFF",
    load: "Seafood transport",
  },
];

const DEMO_ALERTS: DemoAlert[] = [
  {
    id: "alert_1",
    title: "AI Dispatch Assigned Carrier",
    message: "Cold-chain dairy load matched to ASO Carrier 101 with 92 score.",
    severity: "HIGH",
  },
  {
    id: "alert_2",
    title: "Revenue Milestone",
    message: "Marketplace revenue crossed $128K in projected monthly volume.",
    severity: "MEDIUM",
  },
  {
    id: "alert_3",
    title: "Fleet GPS Healthy",
    message: "All active drivers have updated GPS within the last 15 minutes.",
    severity: "LOW",
  },
];

export default function ExecutiveDemo() {
  const pulse = useRef(new Animated.Value(1)).current;
  const [revenue, setRevenue] = useState(128450);
  const [orders, setOrders] = useState(842);
  const [loads, setLoads] = useState(316);
  const [aiScore, setAiScore] = useState(91);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    pulseLoop.start();

    const interval = setInterval(() => {
      setRevenue((value) => value + Math.floor(Math.random() * 450));
      setOrders((value) => value + Math.floor(Math.random() * 3));
      setLoads((value) => value + Math.floor(Math.random() * 2));
      setAiScore(88 + Math.floor(Math.random() * 10));
    }, 2500);

    return () => {
      pulseLoop.stop();
      clearInterval(interval);
    };
  }, [pulse]);

  function severityColor(severity: string) {
    switch (severity) {
      case "CRITICAL":
        return "#DC2626";
      case "HIGH":
        return "#F59E0B";
      case "MEDIUM":
        return "#2563EB";
      default:
        return "#10B981";
    }
  }

  function statusColor(status: string) {
    switch (status) {
      case "EN_ROUTE_TO_PICKUP":
        return "#2563EB";
      case "PICKED_UP":
        return "#F59E0B";
      case "IN_TRANSIT":
      case "EN_ROUTE_TO_DROPOFF":
        return "#7C3AED";
      case "DELIVERED":
        return "#10B981";
      default:
        return "#64748B";
    }
  }

  function money(value: number) {
    return `$${value.toLocaleString()}`;
  }

  function renderStat(label: string, value: string | number, accent = false) {
    return (
      <View style={[styles.statCard, accent && styles.statCardAccent]}>
        <Text style={[styles.statValue, accent && styles.statValueAccent]}>
          {value}
        </Text>
        <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <Animated.View
          style={[
            styles.demoMapIconWrap,
            {
              transform: [{ scale: pulse }],
            },
          ]}
        >
          <Text style={styles.demoMapIcon}>🚚</Text>
        </Animated.View>

        <Text style={styles.mapTitle}>Executive Live Map Preview</Text>

        <Text style={styles.mapText}>
          Web-safe demo mode is active. Native GPS route maps can be enabled for
          iOS and Android after web testing.
        </Text>

        <View style={styles.mapTruckRow}>
          {DEMO_TRUCKS.map((truck) => (
            <View key={truck.id} style={styles.mapTruckChip}>
              <View
                style={[
                  styles.mapTruckDot,
                  {
                    backgroundColor: statusColor(truck.status),
                  },
                ]}
              />
              <Text style={styles.mapTruckText}>
                {truck.city}, {truck.state}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner}>
        <Text style={styles.eyebrow}>ASO Developments LLC</Text>
        <Text style={styles.title}>Farm2Home Executive Demo</Text>

        <Text style={styles.subtitle}>
          AI-powered farm marketplace, freight dispatch, live GPS logistics,
          driver workflows, and enterprise command visibility in one platform.
        </Text>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/admin/live-operations-center")}
          >
            <Text style={styles.navText}>Live Ops</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/ai/autonomous-dispatch-dashboard")}
          >
            <Text style={styles.navTextOutline}>AI Dispatch</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          {renderStat("Projected Revenue", money(revenue), true)}
          {renderStat("Marketplace Orders", orders)}
          {renderStat("Freight Loads", loads)}
          {renderStat("AI Match Score", `${aiScore}%`, true)}
          {renderStat("Active Trucks", DEMO_TRUCKS.length)}
          {renderStat("Delivery Success", "98.7%")}
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroCardTitle}>Investor Snapshot</Text>
          <Text style={styles.heroCardText}>
            Farm2Home connects customers, farmers, and freight carriers through
            a unified AI commerce and logistics platform.
          </Text>

          <View style={styles.valueGrid}>
            <View style={styles.valueItem}>
              <Text style={styles.valueIcon}>🛒</Text>
              <Text style={styles.valueTitle}>Marketplace</Text>
              <Text style={styles.valueText}>Fresh local goods by farm.</Text>
            </View>

            <View style={styles.valueItem}>
              <Text style={styles.valueIcon}>🚚</Text>
              <Text style={styles.valueTitle}>Freight</Text>
              <Text style={styles.valueText}>DAT-style load network.</Text>
            </View>

            <View style={styles.valueItem}>
              <Text style={styles.valueIcon}>🤖</Text>
              <Text style={styles.valueTitle}>AI Dispatch</Text>
              <Text style={styles.valueText}>Autonomous carrier matching.</Text>
            </View>

            <View style={styles.valueItem}>
              <Text style={styles.valueIcon}>📍</Text>
              <Text style={styles.valueTitle}>Live GPS</Text>
              <Text style={styles.valueText}>Fleet and delivery tracking.</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Live AI Events</Text>

        {DEMO_ALERTS.map((alert) => (
          <View key={alert.id} style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
              </View>

              <View
                style={[
                  styles.alertBadge,
                  {
                    backgroundColor: severityColor(alert.severity),
                  },
                ]}
              >
                <Text style={styles.alertBadgeText}>{alert.severity}</Text>
              </View>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Fleet Activity</Text>

        <FlatList
          data={DEMO_TRUCKS}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => (
            <View style={styles.truckCard}>
              <View style={styles.truckHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.truckName}>{item.name}</Text>
                  <Text style={styles.truckSub}>
                    {item.city}, {item.state} · {item.load}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: statusColor(item.status),
                    },
                  ]}
                >
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
            </View>
          )}
        />

        <View style={styles.pitchCard}>
          <Text style={styles.pitchTitle}>Platform Positioning</Text>
          <Text style={styles.pitchText}>
            Farm2Home is positioned as an AI-enabled commerce and logistics
            platform for fresh food, farm goods, regional freight, and last-mile
            delivery operations.
          </Text>

          <Text style={styles.pitchText}>
            The system combines marketplace revenue, subscription revenue,
            freight transaction revenue, delivery fees, and AI operations tools.
          </Text>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  mapWrap: {
    height: "36%",
    backgroundColor: "#DDEFE4",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  demoMapIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    marginBottom: 12,
  },

  demoMapIcon: {
    fontSize: 38,
  },

  mapTitle: {
    color: "#111827",
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  mapText: {
    color: "#374151",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 520,
  },

  mapTruckRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 14,
  },

  mapTruckChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  mapTruckDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  mapTruckText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
  },

  panel: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },

  panelInner: {
    padding: 18,
    paddingBottom: 90,
  },

  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 6,
  },

  title: {
    color: "#111827",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 8,
  },

  subtitle: {
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 14,
  },

  navRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  navButton: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navTextOutline: {
    color: "#10B981",
    fontWeight: "900",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },

  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  statCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },

  statValue: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
  },

  statValueAccent: {
    color: "#FFFFFF",
  },

  statLabel: {
    color: "#6B7280",
    fontWeight: "800",
    marginTop: 4,
  },

  statLabelAccent: {
    color: "#BBF7D0",
  },

  heroCard: {
    backgroundColor: "#064E3B",
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },

  heroCardTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },

  heroCardText: {
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 14,
  },

  valueGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  valueItem: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 12,
  },

  valueIcon: {
    fontSize: 24,
    marginBottom: 6,
  },

  valueTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    marginBottom: 4,
  },

  valueText: {
    color: "#D1FAE5",
    fontWeight: "700",
    lineHeight: 19,
    fontSize: 12,
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },

  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  alertHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },

  alertTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 5,
  },

  alertMessage: {
    color: "#374151",
    fontWeight: "700",
    lineHeight: 20,
  },

  alertBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  alertBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },

  truckCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  truckHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },

  truckName: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },

  truckSub: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 150,
  },

  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 9,
  },

  pitchCard: {
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 18,
    marginTop: 4,
  },

  pitchTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 10,
  },

  pitchText: {
    color: "#D1D5DB",
    fontWeight: "700",
    lineHeight: 23,
    marginBottom: 8,
  },
});