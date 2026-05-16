import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "../data/supabaseClient";

type ControlStats = {
  totalOrders: number;
  activeOrders: number;
  openLoads: number;
  activeLoads: number;
  activeDrivers: number;
  pendingVerifications: number;
  revenue: number;
};

type OrderRow = {
  id: string;
  status: string;
  total: number;
  created_at: string;
  customers?: {
    full_name?: string;
    email?: string;
    phone?: string;
  };
  farmers?: {
    farm_name?: string;
    owner_name?: string;
  };
};

type LoadRow = {
  id: string;
  title?: string;
  commodity?: string;
  pickup_city?: string;
  pickup_state?: string;
  delivery_city?: string;
  delivery_state?: string;
  rate?: number;
  status?: string;
  created_at?: string;
  farmers?: {
    farm_name?: string;
  };
  freight_carriers?: {
    company_name?: string;
  };
};

type DriverRow = {
  id: string;
  load_id: string;
  latitude: number;
  longitude: number;
  status: string;
  updated_at: string;
  freight_carriers?: {
    company_name?: string;
  };
};

type VerificationRow = {
  id: string;
  account_type?: string;
  business_name?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  created_at?: string;
};

export default function AdminControlTower() {
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<ControlStats>({
    totalOrders: 0,
    activeOrders: 0,
    openLoads: 0,
    activeLoads: 0,
    activeDrivers: 0,
    pendingVerifications: 0,
    revenue: 0,
  });

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [verifications, setVerifications] = useState<VerificationRow[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      loadControlTower();
    }, [])
  );

  async function loadControlTower() {
    try {
      setLoading(true);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          `
          *,
          customers (
            full_name,
            email,
            phone
          ),
          farmers (
            farm_name,
            owner_name
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(25);

      if (orderError) {
        console.log("Control tower orders error:", orderError.message);
      }

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select(
          `
          *,
          farmers (
            farm_name
          ),
          freight_carriers (
            company_name
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(25);

      if (loadError) {
        console.log("Control tower loads error:", loadError.message);
      }

      const { data: driverData, error: driverError } = await supabase
        .from("driver_locations")
        .select(
          `
          *,
          freight_carriers (
            company_name
          )
        `
        )
        .order("updated_at", { ascending: false })
        .limit(25);

      if (driverError) {
        console.log("Control tower drivers error:", driverError.message);
      }

      const { data: verificationData, error: verificationError } =
        await supabase
          .from("verification_records")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(25);

      if (verificationError) {
        console.log(
          "Control tower verification error:",
          verificationError.message
        );
      }

      const cleanOrders = (orderData || []) as OrderRow[];
      const cleanLoads = (loadData || []) as LoadRow[];
      const cleanDrivers = (driverData || []).map((item: any) => ({
        ...item,
        latitude: Number(item.latitude || 0),
        longitude: Number(item.longitude || 0),
      })) as DriverRow[];
      const cleanVerifications = (verificationData || []) as VerificationRow[];

      setOrders(cleanOrders);
      setLoads(cleanLoads);
      setDrivers(cleanDrivers);
      setVerifications(cleanVerifications);

      const activeOrderStatuses = [
        "PAID",
        "ACCEPTED",
        "PREPARING",
        "READY_FOR_PICKUP",
        "PICKED_UP",
        "IN_TRANSIT",
        "PENDING_PAYMENT",
      ];

      const activeLoadStatuses = [
        "BOOKED",
        "ACCEPTED",
        "PICKED_UP",
        "IN_TRANSIT",
      ];

      const revenue = cleanOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      );

      setStats({
        totalOrders: cleanOrders.length,
        activeOrders: cleanOrders.filter((item) =>
          activeOrderStatuses.includes(item.status)
        ).length,
        openLoads: cleanLoads.filter((item) => item.status === "OPEN").length,
        activeLoads: cleanLoads.filter((item) =>
          activeLoadStatuses.includes(item.status || "")
        ).length,
        activeDrivers: cleanDrivers.filter((item) =>
          ["EN_ROUTE_TO_PICKUP", "PICKED_UP", "EN_ROUTE_TO_DROPOFF"].includes(
            item.status
          )
        ).length,
        pendingVerifications: cleanVerifications.filter((item) =>
          ["PENDING", "PENDING_VERIFICATION", "DOCUMENTS_SUBMITTED"].includes(
            item.status || ""
          )
        ).length,
        revenue,
      });
    } catch (error) {
      console.log("Control tower load error:", error);
      Alert.alert("Load Error", "Unable to load control tower data.");
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status?: string) {
    switch (status) {
      case "OPEN":
      case "PAID":
        return "#1565C0";
      case "ACCEPTED":
      case "BOOKED":
        return "#2F7D32";
      case "PREPARING":
      case "PICKED_UP":
        return "#EF6C00";
      case "IN_TRANSIT":
      case "EN_ROUTE_TO_DROPOFF":
        return "#0F766E";
      case "DELIVERED":
        return "#00897B";
      case "CANCELLED":
      case "REFUNDED":
        return "#C62828";
      case "DOCUMENTS_SUBMITTED":
      case "PENDING":
      case "PENDING_VERIFICATION":
        return "#6A1B9A";
      default:
        return "#64748B";
    }
  }

  function renderBadge(status?: string) {
    return (
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: getStatusColor(status),
          },
        ]}
      >
        <Text style={styles.statusText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  function renderStat(label: string, value: string | number, accent?: boolean) {
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
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Admin</Text>

        <Text style={styles.title}>Operations Control Tower</Text>

        <Text style={styles.subtitle}>
          Monitor orders, freight loads, drivers, verification approvals,
          revenue, and platform activity from one command center.
        </Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/admin/dashboard")}
        >
          <Text style={styles.navText}>Admin Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/ai/dispatch-dashboard")}
        >
          <Text style={styles.navTextOutline}>AI Dispatch</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#10B981" />

          <Text style={styles.loadingText}>Loading control tower...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.statsGrid}>
            {renderStat("Total Orders", stats.totalOrders)}
            {renderStat("Active Orders", stats.activeOrders)}
            {renderStat("Open Loads", stats.openLoads)}
            {renderStat("Active Loads", stats.activeLoads)}
            {renderStat("Active Drivers", stats.activeDrivers)}
            {renderStat("Pending Reviews", stats.pendingVerifications)}
            {renderStat("Revenue", `$${stats.revenue.toFixed(0)}`, true)}
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={loadControlTower}>
            <Text style={styles.refreshText}>Refresh Control Tower</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Live Orders</Text>

          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No orders found.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Order #{item.id.slice(-6)}</Text>

                    <Text style={styles.cardSub}>
                      {item.customers?.full_name ||
                        item.customers?.email ||
                        "Customer"}
                    </Text>
                  </View>

                  {renderBadge(item.status)}
                </View>

                <Text style={styles.metaText}>
                  Farm: {item.farmers?.farm_name || "Not assigned"}
                </Text>

                <Text style={styles.metaText}>
                  Total: ${Number(item.total || 0).toFixed(2)}
                </Text>

                <Text style={styles.metaText}>
                  Created:{" "}
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString()
                    : "Unknown"}
                </Text>
              </View>
            )}
          />

          <Text style={styles.sectionTitle}>Freight Loads</Text>

          <FlatList
            data={loads}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No freight loads found.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {item.title || "Farm2Home Load"}
                    </Text>

                    <Text style={styles.cardSub}>
                      {item.commodity || "Farm Freight"}
                    </Text>
                  </View>

                  {renderBadge(item.status)}
                </View>

                <Text style={styles.metaText}>
                  Route: {item.pickup_city || "TBD"},{" "}
                  {item.pickup_state || ""} → {item.delivery_city || "TBD"},{" "}
                  {item.delivery_state || ""}
                </Text>

                <Text style={styles.metaText}>
                  Carrier: {item.freight_carriers?.company_name || "Unassigned"}
                </Text>

                <Text style={styles.metaText}>
                  Rate: ${Number(item.rate || 0).toFixed(2)}
                </Text>
              </View>
            )}
          />

          <Text style={styles.sectionTitle}>Driver GPS Activity</Text>

          <FlatList
            data={drivers}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No driver GPS activity yet.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {item.freight_carriers?.company_name || "Driver"}
                    </Text>

                    <Text style={styles.cardSub}>
                      Load #{item.load_id?.slice(-6)}
                    </Text>
                  </View>

                  {renderBadge(item.status)}
                </View>

                <Text style={styles.metaText}>
                  GPS: {Number(item.latitude || 0).toFixed(5)},{" "}
                  {Number(item.longitude || 0).toFixed(5)}
                </Text>

                <Text style={styles.metaText}>
                  Updated:{" "}
                  {item.updated_at
                    ? new Date(item.updated_at).toLocaleString()
                    : "Unknown"}
                </Text>
              </View>
            )}
          />

          <Text style={styles.sectionTitle}>Verification Queue</Text>

          <FlatList
            data={verifications}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No verifications found.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {item.business_name || "Applicant"}
                    </Text>

                    <Text style={styles.cardSub}>
                      {item.account_type || "Account"} ·{" "}
                      {item.owner_name || "Owner not provided"}
                    </Text>
                  </View>

                  {renderBadge(item.status)}
                </View>

                <Text style={styles.metaText}>
                  Email: {item.email || "Not provided"}
                </Text>

                <Text style={styles.metaText}>
                  Phone: {item.phone || "Not provided"}
                </Text>

                <TouchableOpacity
                  style={styles.reviewButton}
                  onPress={() => router.push("/admin/dashboard")}
                >
                  <Text style={styles.reviewText}>Review Application</Text>
                </TouchableOpacity>
              </View>
            )}
          />

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  hero: {
    backgroundColor: "#111827",
    paddingTop: 66,
    paddingHorizontal: 20,
    paddingBottom: 28,
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

  loadingCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    padding: 26,
    borderRadius: 20,
    alignItems: "center",
  },

  loadingText: {
    color: "#6B7280",
    marginTop: 10,
    fontWeight: "800",
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },

  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  statCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },

  statValue: {
    color: "#111827",
    fontSize: 26,
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

  refreshButton: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 18,
  },

  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
    marginTop: 8,
  },

  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  cardHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    alignItems: "flex-start",
  },

  cardTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },

  cardSub: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 4,
  },

  metaText: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 5,
    lineHeight: 20,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },

  reviewButton: {
    backgroundColor: "#10B981",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },

  reviewText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  emptyTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 17,
  },
});