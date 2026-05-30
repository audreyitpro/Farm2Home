// app/admin/control-tower.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F5F7FB",
  sidebar: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  soft: "#F9FAFB",
  primary: "#7C3AED",
  primarySoft: "#EDE9FE",
  green: "#10B981",
  blue: "#2563EB",
  orange: "#F59E0B",
  red: "#EF4444",
  dark: "#1F2937",
};

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
  customers?: { full_name?: string; email?: string; phone?: string };
  farmers?: { farm_name?: string; owner_name?: string };
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
  amount?: number;
  price?: number;
  status?: string;
  created_at?: string;
  farmers?: { farm_name?: string };
  freight_carriers?: { company_name?: string };
};

type DriverRow = {
  id: string;
  load_id: string;
  latitude: number;
  longitude: number;
  status: string;
  updated_at: string;
  freight_carriers?: { company_name?: string };
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

      if (orderError) console.log("Control tower orders error:", orderError.message);

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

      if (loadError) console.log("Control tower loads error:", loadError.message);

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

      if (driverError) console.log("Control tower drivers error:", driverError.message);

      const { data: verificationData, error: verificationError } = await supabase
        .from("verification_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);

      if (verificationError) {
        console.log("Control tower verification error:", verificationError.message);
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
        "paid",
        "accepted",
        "preparing",
        "ready_for_pickup",
        "picked_up",
        "in_transit",
        "pending_payment",
      ];

      const activeLoadStatuses = [
        "BOOKED",
        "ACCEPTED",
        "accepted",
        "ASSIGNED",
        "assigned",
        "PICKED_UP",
        "picked_up",
        "IN_TRANSIT",
        "in_transit",
        "arrived_pickup",
        "arrived_dropoff",
      ];

      const revenue = cleanOrders.reduce(
        (sum, order) => sum + Number(order.total || 0),
        0
      );

      setStats({
        totalOrders: cleanOrders.length,
        activeOrders: cleanOrders.filter((item) =>
          activeOrderStatuses.includes(String(item.status || ""))
        ).length,
        openLoads: cleanLoads.filter((item) =>
          ["OPEN", "available", "AVAILABLE", "open", "pending", "PENDING"].includes(
            String(item.status || "")
          )
        ).length,
        activeLoads: cleanLoads.filter((item) =>
          activeLoadStatuses.includes(String(item.status || ""))
        ).length,
        activeDrivers: cleanDrivers.filter((item) =>
          [
            "EN_ROUTE_TO_PICKUP",
            "PICKED_UP",
            "EN_ROUTE_TO_DROPOFF",
            "accepted",
            "picked_up",
            "in_transit",
            "IN_TRANSIT",
          ].includes(String(item.status || ""))
        ).length,
        pendingVerifications: cleanVerifications.filter((item) =>
          [
            "PENDING",
            "PENDING_VERIFICATION",
            "DOCUMENTS_SUBMITTED",
            "PENDING_ADMIN_REVIEW",
            "pending",
            "pending_verification",
            "documents_submitted",
            "pending_admin_review",
          ].includes(String(item.status || ""))
        ).length,
        revenue,
      });
    } catch (error: any) {
      console.log("Control tower load error:", error);
      Alert.alert(
        "Load Error",
        error?.message || "Unable to load control tower data."
      );
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status?: string) {
    switch (status) {
      case "OPEN":
      case "available":
      case "AVAILABLE":
      case "open":
      case "pending":
      case "PENDING":
      case "PAID":
      case "paid":
        return ui.blue;
      case "ACCEPTED":
      case "BOOKED":
      case "accepted":
      case "ASSIGNED":
      case "assigned":
      case "DELIVERED":
      case "delivered":
        return ui.green;
      case "PREPARING":
      case "PICKED_UP":
      case "picked_up":
        return ui.orange;
      case "IN_TRANSIT":
      case "in_transit":
      case "EN_ROUTE_TO_DROPOFF":
        return "#0F766E";
      case "CANCELLED":
      case "REFUNDED":
      case "cancelled":
      case "canceled":
        return ui.red;
      case "DOCUMENTS_SUBMITTED":
      case "PENDING_VERIFICATION":
      case "PENDING_ADMIN_REVIEW":
        return ui.primary;
      default:
        return "#64748B";
    }
  }

  function renderBadge(status?: string) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.statusText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>F2H</Text>
            </View>
            <View>
              <Text style={styles.logoTitle}>Farm2Home</Text>
              <Text style={styles.logoSub}>Admin Portal</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" active />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
          <NavButton label="AI Dispatch" icon="sparkles-outline" route="/ai/dispatch-intelligence-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Welcome back, Admin</Text>
              <Text style={styles.pageTitle}>Operations Control Tower</Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadControlTower}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={ui.primary} />
              <Text style={styles.loadingText}>Loading control tower...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.statsGrid}>
                <StatCard label="Revenue" value={formatMoney(stats.revenue)} icon="cash-outline" accent />
                <StatCard label="Total Orders" value={String(stats.totalOrders)} icon="receipt-outline" />
                <StatCard label="Active Orders" value={String(stats.activeOrders)} icon="time-outline" />
                <StatCard label="Open Loads" value={String(stats.openLoads)} icon="file-tray-outline" />
                <StatCard label="Active Loads" value={String(stats.activeLoads)} icon="cube-outline" />
                <StatCard label="Active Drivers" value={String(stats.activeDrivers)} icon="car-outline" />
                <StatCard label="Pending Reviews" value={String(stats.pendingVerifications)} icon="shield-checkmark-outline" warning />
              </View>

              <View style={styles.overviewGrid}>
                <View style={styles.chartCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Platform Flow</Text>
                    <Text style={styles.sectionLink}>Today</Text>
                  </View>

                  <View style={styles.flowRow}>
                    <FlowMetric label="Orders" value={stats.totalOrders} color={ui.primary} />
                    <FlowMetric label="Loads" value={stats.openLoads + stats.activeLoads} color={ui.blue} />
                    <FlowMetric label="Drivers" value={stats.activeDrivers} color={ui.green} />
                    <FlowMetric label="Reviews" value={stats.pendingVerifications} color={ui.orange} />
                  </View>
                </View>

                <View style={styles.chartCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <Text style={styles.sectionLink}>Admin</Text>
                  </View>

                  <View style={styles.quickGrid}>
                    <QuickAction label="Review Docs" icon="document-text-outline" route="/admin/documents" />
                    <QuickAction label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
                    <QuickAction label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
                    <QuickAction label="Dispatch AI" icon="sparkles-outline" route="/ai/dispatch-intelligence-center" />
                  </View>
                </View>
              </View>

              <DataSection title="Live Orders">
                <FlatList
                  data={orders}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ListEmptyComponent={<EmptyCard title="No orders found." />}
                  renderItem={({ item }) => (
                    <DataRow
                      icon="receipt-outline"
                      title={`Order #${item.id.slice(-6)}`}
                      subtitle={item.customers?.full_name || item.customers?.email || "Customer"}
                      meta={`Farm: ${item.farmers?.farm_name || "Not assigned"} • ${formatMoney(Number(item.total || 0))}`}
                      badge={renderBadge(item.status)}
                    />
                  )}
                />
              </DataSection>

              <DataSection title="Freight Loads">
                <FlatList
                  data={loads}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ListEmptyComponent={<EmptyCard title="No freight loads found." />}
                  renderItem={({ item }) => (
                    <DataRow
                      icon="cube-outline"
                      title={item.title || "Farm2Home Load"}
                      subtitle={item.commodity || "Farm Freight"}
                      meta={`${item.pickup_city || "TBD"}, ${item.pickup_state || ""} → ${item.delivery_city || "TBD"}, ${item.delivery_state || ""} • ${formatMoney(Number(item.rate || item.amount || item.price || 0))}`}
                      badge={renderBadge(item.status)}
                    />
                  )}
                />
              </DataSection>

              <DataSection title="Driver GPS Activity">
                <FlatList
                  data={drivers}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ListEmptyComponent={<EmptyCard title="No driver GPS activity yet." />}
                  renderItem={({ item }) => (
                    <DataRow
                      icon="navigate-outline"
                      title={item.freight_carriers?.company_name || "Driver"}
                      subtitle={`Load #${item.load_id?.slice(-6) || "Unknown"}`}
                      meta={`GPS: ${Number(item.latitude || 0).toFixed(5)}, ${Number(item.longitude || 0).toFixed(5)}`}
                      badge={renderBadge(item.status)}
                    />
                  )}
                />
              </DataSection>

              <DataSection title="Verification Queue">
                <FlatList
                  data={verifications}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  contentContainerStyle={{ paddingBottom: 80 }}
                  ListEmptyComponent={<EmptyCard title="No verifications found." />}
                  renderItem={({ item }) => (
                    <View style={styles.verificationRow}>
                      <DataRow
                        icon="shield-checkmark-outline"
                        title={item.business_name || "Applicant"}
                        subtitle={`${item.account_type || "Account"} • ${item.owner_name || "Owner not provided"}`}
                        meta={`Email: ${item.email || "Not provided"} • Phone: ${item.phone || "Not provided"}`}
                        badge={renderBadge(item.status)}
                      />

                      <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => router.push("/admin/documents" as any)}
                      >
                        <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.reviewText}>Review Application</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              </DataSection>
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  icon,
  route,
  active = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.navButton, active && styles.navButtonActive]}
      onPress={() => router.push(route as any)}
    >
      <Ionicons name={icon} size={18} color={active ? "#FFFFFF" : ui.muted} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
  warning = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  warning?: boolean;
}) {
  const color = accent ? ui.primary : warning ? ui.orange : ui.blue;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FlowMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.flowMetric}>
      <View style={[styles.flowDot, { backgroundColor: color }]} />
      <Text style={styles.flowValue}>{value}</Text>
      <Text style={styles.flowLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  label,
  icon,
  route,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={18} color={ui.primary} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

function DataSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.dataSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionLink}>View all</Text>
      </View>
      {children}
    </View>
  );
}

function DataRow({
  icon,
  title,
  subtitle,
  meta,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  meta: string;
  badge: React.ReactNode;
}) {
  return (
    <View style={styles.dataRow}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={ui.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
        <Text style={styles.rowMeta}>{meta}</Text>
      </View>

      {badge}
    </View>
  );
}

function EmptyCard({ title }: { title: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="file-tray-outline" size={28} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  shell: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  sidebar: {
    backgroundColor: ui.sidebar,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  logoTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
  },
  logoSub: {
    color: ui.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: ui.soft,
  },
  navButtonActive: {
    backgroundColor: ui.primary,
  },
  navText: {
    color: ui.muted,
    fontWeight: "900",
    fontSize: 13,
  },
  navTextActive: {
    color: "#FFFFFF",
  },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topbar: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcome: {
    color: ui.muted,
    fontWeight: "800",
    marginBottom: 4,
  },
  pageTitle: {
    color: ui.text,
    fontSize: 26,
    fontWeight: "900",
  },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: {
    color: ui.primary,
    fontWeight: "900",
  },
  loadingCard: {
    backgroundColor: ui.card,
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
  },
  loadingText: {
    color: ui.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    color: ui.text,
    fontSize: 23,
    fontWeight: "900",
  },
  statLabel: {
    color: ui.muted,
    fontWeight: "800",
    marginTop: 4,
  },
  overviewGrid: {
    gap: 12,
    marginBottom: 14,
  },
  chartCard: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: ui.text,
    fontSize: 20,
    fontWeight: "900",
  },
  sectionLink: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  flowRow: {
    flexDirection: "row",
    gap: 10,
  },
  flowMetric: {
    flex: 1,
    backgroundColor: ui.soft,
    borderRadius: 16,
    padding: 12,
  },
  flowDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginBottom: 8,
  },
  flowValue: {
    color: ui.text,
    fontSize: 20,
    fontWeight: "900",
  },
  flowLabel: {
    color: ui.muted,
    fontWeight: "800",
    marginTop: 2,
    fontSize: 12,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickAction: {
    width: "48%",
    backgroundColor: ui.soft,
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickText: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 12,
  },
  dataSection: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 15,
  },
  rowSub: {
    color: ui.muted,
    fontWeight: "800",
    marginTop: 3,
  },
  rowMeta: {
    color: ui.muted,
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    maxWidth: 120,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 9,
    textAlign: "center",
  },
  verificationRow: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  reviewButton: {
    backgroundColor: ui.primary,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    marginBottom: 10,
  },
  reviewText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  emptyCard: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: ui.text,
    fontWeight: "900",
    marginTop: 8,
  },
});