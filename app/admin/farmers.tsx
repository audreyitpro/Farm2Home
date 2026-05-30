// app/admin/farmers.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F5F7FB",
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
};

type FarmerRow = {
  id: string;
  farm_name?: string | null;
  owner_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  approved?: boolean | null;
  created_at?: string | null;
};

type OrderRow = {
  id: string;
  farmer_id?: string | null;
  total?: number | null;
  status?: string | null;
};

type SubscriptionRow = {
  id: string;
  farmer_id?: string | null;
  status?: string | null;
};

type VerificationRow = {
  id: string;
  farmer_id?: string | null;
  business_name?: string | null;
  status?: string | null;
};

type FarmerCard = FarmerRow & {
  revenue: number;
  orderCount: number;
  subscriptionStatus: string;
  verificationStatus: string;
};

export default function AdminFarmers() {
  const [loading, setLoading] = useState(true);
  const [farmers, setFarmers] = useState<FarmerCard[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadFarmers();
    }, [])
  );

  async function loadFarmers() {
    try {
      setLoading(true);

      const { data: farmerData } = await supabase
        .from("farmers")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: orderData } = await supabase
        .from("orders")
        .select("id, farmer_id, total, status");

      const { data: subData } = await supabase
        .from("farmer_subscriptions")
        .select("*");

      const { data: verificationData } = await supabase
        .from("verification_records")
        .select("*");

      const cleanFarmers = Array.isArray(farmerData) ? farmerData : [];
      const cleanOrders = Array.isArray(orderData) ? (orderData as OrderRow[]) : [];
      const cleanSubs = Array.isArray(subData) ? (subData as SubscriptionRow[]) : [];
      const cleanVerifications = Array.isArray(verificationData)
        ? (verificationData as VerificationRow[])
        : [];

      const mapped: FarmerCard[] = cleanFarmers.map((farmer: any) => {
        const farmerOrders = cleanOrders.filter(
          (order) => String(order.farmer_id || "") === String(farmer.id)
        );

        const sub = cleanSubs.find(
          (item) => String(item.farmer_id || "") === String(farmer.id)
        );

        const verification = cleanVerifications.find(
          (item) =>
            String(item.farmer_id || "") === String(farmer.id) ||
            String(item.business_name || "").toLowerCase() ===
              String(farmer.farm_name || "").toLowerCase()
        );

        return {
          ...farmer,
          revenue: farmerOrders.reduce(
            (sum, order) => sum + Number(order.total || 0),
            0
          ),
          orderCount: farmerOrders.length,
          subscriptionStatus: sub?.status || "none",
          verificationStatus: verification?.status || farmer.status || "unknown",
        };
      });

      setFarmers(mapped);
    } catch (error: any) {
      Alert.alert("Farmers Error", error?.message || "Unable to load farmers.");
    } finally {
      setLoading(false);
    }
  }

  const filteredFarmers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return farmers;

    return farmers.filter((farmer) =>
      [
        farmer.farm_name,
        farmer.owner_name,
        farmer.email,
        farmer.phone,
        farmer.status,
        farmer.subscriptionStatus,
        farmer.verificationStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [farmers, search]);

  const stats = useMemo(() => {
    const revenue = farmers.reduce((sum, farmer) => sum + farmer.revenue, 0);
    const approved = farmers.filter(
      (farmer) =>
        farmer.approved === true ||
        farmer.status === "APPROVED" ||
        farmer.status === "approved"
    ).length;
    const pending = farmers.filter((farmer) =>
      ["PENDING", "PENDING_ADMIN_REVIEW", "pending", "pending_admin_review"].includes(
        String(farmer.verificationStatus || "")
      )
    ).length;
    const subscribed = farmers.filter((farmer) =>
      ["active", "ACTIVE", "paid", "PAID"].includes(
        String(farmer.subscriptionStatus || "")
      )
    ).length;

    return {
      total: farmers.length,
      approved,
      pending,
      subscribed,
      revenue,
    };
  }, [farmers]);

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();
    if (["approved", "active", "paid"].includes(value)) return ui.green;
    if (["pending", "pending_admin_review", "documents_submitted"].includes(value)) {
      return ui.orange;
    }
    if (["rejected", "suspended", "cancelled"].includes(value)) return ui.red;
    return ui.blue;
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading farmers...</Text>
      </SafeAreaView>
    );
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
              <Text style={styles.logoSub}>Farmer Management</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Farmers" icon="leaf-outline" route="/admin/farmers" active />
          <NavButton label="Customers" icon="people-outline" route="/admin/customers" />
          <NavButton label="Orders" icon="receipt-outline" route="/admin/orders" />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin</Text>
              <Text style={styles.pageTitle}>Farmers</Text>
              <Text style={styles.pageSub}>
                Manage farmer approval, store status, memberships, and marketplace revenue.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadFarmers}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Farmers" value={String(stats.total)} icon="leaf-outline" accent />
              <StatCard label="Approved" value={String(stats.approved)} icon="checkmark-circle-outline" success />
              <StatCard label="Pending Review" value={String(stats.pending)} icon="shield-checkmark-outline" warning />
              <StatCard label="Subscribed" value={String(stats.subscribed)} icon="card-outline" />
              <StatCard label="Farmer Revenue" value={formatMoney(stats.revenue)} icon="cash-outline" accent />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search farm name, owner, email, phone, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Farmer Directory</Text>
                <Text style={styles.sectionLink}>{filteredFarmers.length} records</Text>
              </View>

              <FlatList
                data={filteredFarmers}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard title="No farmers found." text="Farmers will appear after registration." />
                }
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <View style={styles.avatar}>
                      <Ionicons name="leaf-outline" size={22} color={ui.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.farm_name || "Farm"}</Text>
                      <Text style={styles.meta}>
                        Owner: {item.owner_name || "Not provided"}
                      </Text>
                      <Text style={styles.meta}>
                        {item.email || "No email"} • {item.phone || "No phone"}
                      </Text>
                      <Text style={styles.meta}>
                        Orders: {item.orderCount} • Revenue: {formatMoney(item.revenue)}
                      </Text>
                      <Text style={styles.meta}>
                        Membership: {item.subscriptionStatus}
                      </Text>
                    </View>

                    <View style={styles.rightCol}>
                      {renderBadge(item.verificationStatus)}
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => router.push("/admin/documents" as any)}
                      >
                        <Text style={styles.viewButtonText}>Review</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            </View>
          </ScrollView>
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
  success = false,
  warning = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  warning?: boolean;
}) {
  const color = success ? ui.green : warning ? ui.orange : accent ? ui.primary : ui.blue;

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

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="leaf-outline" size={30} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: ui.muted, marginTop: 10, fontWeight: "800" },
  shell: { flex: 1, backgroundColor: ui.bg },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  logoTitle: { color: ui.text, fontWeight: "900", fontSize: 18 },
  logoSub: { color: ui.muted, fontWeight: "700", fontSize: 12 },
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
  navButtonActive: { backgroundColor: ui.primary },
  navText: { color: ui.muted, fontWeight: "900", fontSize: 13 },
  navTextActive: { color: "#FFFFFF" },
  main: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
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
  welcome: { color: ui.muted, fontWeight: "800", marginBottom: 4 },
  pageTitle: { color: ui.text, fontSize: 26, fontWeight: "900" },
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 720 },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: { color: ui.primary, fontWeight: "900" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
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
  statValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  statLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },
  searchCard: {
    backgroundColor: ui.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },
  dataSection: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { color: ui.text, fontSize: 19, fontWeight: "900" },
  sectionLink: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: ui.text, fontWeight: "900", fontSize: 16 },
  meta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  rightCol: { alignItems: "flex-end", gap: 8 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
  },
  viewButton: {
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  emptyCard: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 8,
    textAlign: "center",
  },
  emptyText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 5,
  },
});