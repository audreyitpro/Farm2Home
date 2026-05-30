// app/admin/freight-carriers.tsx

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

type CarrierRow = {
  id: string;
  company_name?: string | null;
  owner_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  approved?: boolean | null;
  mc_number?: string | null;
  dot_number?: string | null;
  insurance_status?: string | null;
  insurance_expiration?: string | null;
  created_at?: string | null;
};

type FreightUserRow = CarrierRow;

type FreightSubscriptionRow = {
  id: string;
  freight_id?: string | null;
  freight_user_id?: string | null;
  carrier_id?: string | null;
  status?: string | null;
};

type FreightLoadRow = {
  id: string;
  carrier_id?: string | null;
  freight_carrier_id?: string | null;
  accepted_by?: string | null;
  status?: string | null;
  rate?: number | null;
  amount?: number | null;
  price?: number | null;
};

type DriverRow = {
  id: string;
  carrier_id?: string | null;
  freight_carrier_id?: string | null;
};

type CarrierCard = CarrierRow & {
  subscriptionStatus: string;
  acceptedLoads: number;
  activeLoads: number;
  deliveredLoads: number;
  driverCount: number;
  revenue: number;
};

export default function AdminFreightCarriers() {
  const [loading, setLoading] = useState(true);
  const [carriers, setCarriers] = useState<CarrierCard[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCarriers();
    }, [])
  );

  async function loadCarriers() {
    try {
      setLoading(true);

      const { data: carrierData } = await supabase
        .from("freight_carriers")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: freightUsersData } = await supabase
        .from("freight_users")
        .select("*");

      const { data: subData } = await supabase
        .from("freight_subscriptions")
        .select("*");

      const { data: loadData } = await supabase.from("freight_loads").select("*");

      const { data: driverData } = await supabase.from("drivers").select("*");

      const cleanCarriers = Array.isArray(carrierData)
        ? (carrierData as CarrierRow[])
        : [];

      const cleanFreightUsers = Array.isArray(freightUsersData)
        ? (freightUsersData as FreightUserRow[])
        : [];

      const cleanSubs = Array.isArray(subData)
        ? (subData as FreightSubscriptionRow[])
        : [];

      const cleanLoads = Array.isArray(loadData)
        ? (loadData as FreightLoadRow[])
        : [];

      const cleanDrivers = Array.isArray(driverData)
        ? (driverData as DriverRow[])
        : [];

      const carrierMap = new Map<string, CarrierRow>();

      cleanCarriers.forEach((carrier) => {
        carrierMap.set(String(carrier.id), carrier);
      });

      cleanFreightUsers.forEach((user) => {
        if (!carrierMap.has(String(user.id))) {
          carrierMap.set(String(user.id), {
            id: String(user.id),
            company_name: user.company_name,
            owner_name: user.owner_name,
            contact_name: user.contact_name,
            email: user.email,
            phone: user.phone,
            status: user.status,
            approved: user.approved,
            mc_number: user.mc_number,
            dot_number: user.dot_number,
            insurance_status: user.insurance_status,
            insurance_expiration: user.insurance_expiration,
            created_at: user.created_at,
          });
        }
      });

      const mapped: CarrierCard[] = Array.from(carrierMap.values()).map(
        (carrier) => {
          const carrierId = String(carrier.id);

          const subscription = cleanSubs.find(
            (item) =>
              String(item.carrier_id || "") === carrierId ||
              String(item.freight_id || "") === carrierId ||
              String(item.freight_user_id || "") === carrierId
          );

          const carrierLoads = cleanLoads.filter(
            (load) =>
              String(load.carrier_id || "") === carrierId ||
              String(load.freight_carrier_id || "") === carrierId ||
              String(load.accepted_by || "") === carrierId
          );

          const driverCount = cleanDrivers.filter(
            (driver) =>
              String(driver.carrier_id || "") === carrierId ||
              String(driver.freight_carrier_id || "") === carrierId
          ).length;

          const activeLoads = carrierLoads.filter((load) =>
            [
              "accepted",
              "assigned",
              "picked_up",
              "in_transit",
              "arrived_pickup",
              "arrived_dropoff",
              "ACCEPTED",
              "ASSIGNED",
              "PICKED_UP",
              "IN_TRANSIT",
            ].includes(String(load.status || ""))
          ).length;

          const deliveredLoads = carrierLoads.filter((load) =>
            ["delivered", "DELIVERED"].includes(String(load.status || ""))
          ).length;

          const revenue = carrierLoads.reduce(
            (sum, load) =>
              sum + Number(load.rate || load.amount || load.price || 0),
            0
          );

          return {
            ...carrier,
            subscriptionStatus: subscription?.status || "none",
            acceptedLoads: carrierLoads.length,
            activeLoads,
            deliveredLoads,
            driverCount,
            revenue,
          };
        }
      );

      setCarriers(mapped);
    } catch (error: any) {
      Alert.alert(
        "Freight Carriers Error",
        error?.message || "Unable to load freight carriers."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredCarriers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return carriers;

    return carriers.filter((carrier) =>
      [
        carrier.company_name,
        carrier.owner_name,
        carrier.contact_name,
        carrier.email,
        carrier.phone,
        carrier.status,
        carrier.subscriptionStatus,
        carrier.mc_number,
        carrier.dot_number,
        carrier.insurance_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [carriers, search]);

  const stats = useMemo(() => {
    const approved = carriers.filter(
      (carrier) =>
        carrier.approved === true ||
        ["approved", "active"].includes(String(carrier.status || "").toLowerCase())
    ).length;

    const subscribed = carriers.filter((carrier) =>
      ["active", "paid", "trialing"].includes(
        String(carrier.subscriptionStatus || "").toLowerCase()
      )
    ).length;

    const activeLoads = carriers.reduce((sum, c) => sum + c.activeLoads, 0);
    const deliveredLoads = carriers.reduce((sum, c) => sum + c.deliveredLoads, 0);
    const driverCount = carriers.reduce((sum, c) => sum + c.driverCount, 0);
    const revenue = carriers.reduce((sum, c) => sum + c.revenue, 0);

    const insuranceIssues = carriers.filter((carrier) =>
      ["expired", "missing", "rejected", "inactive"].includes(
        String(carrier.insurance_status || "").toLowerCase()
      )
    ).length;

    return {
      total: carriers.length,
      approved,
      subscribed,
      activeLoads,
      deliveredLoads,
      driverCount,
      insuranceIssues,
      revenue,
    };
  }, [carriers]);

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["approved", "active", "paid", "trialing", "valid"].includes(value)) {
      return ui.green;
    }

    if (["pending", "review", "pending_admin_review", "expiring"].includes(value)) {
      return ui.orange;
    }

    if (
      ["rejected", "blocked", "cancelled", "canceled", "inactive", "expired", "missing"].includes(
        value
      )
    ) {
      return ui.red;
    }

    return ui.blue;
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  function formatDate(value?: string | null) {
    if (!value) return "Not provided";
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return "Not provided";
    }
  }

  async function updateCarrierStatus(carrierId: string, status: string) {
    try {
      const { error } = await supabase
        .from("freight_carriers")
        .update({
          status,
          approved: status === "approved",
        })
        .eq("id", carrierId);

      if (error) {
        console.log("Carrier update error:", error.message);
      }

      setCarriers((prev) =>
        prev.map((item) =>
          item.id === carrierId
            ? { ...item, status, approved: status === "approved" }
            : item
        )
      );
    } catch (error: any) {
      Alert.alert("Update Failed", error?.message || "Unable to update carrier.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading freight carriers...</Text>
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
              <Text style={styles.logoSub}>Freight Carriers</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Carriers" icon="business-outline" route="/admin/freight-carriers" active />
          <NavButton label="Drivers" icon="car-outline" route="/admin/drivers" />
          <NavButton label="Freight Loads" icon="cube-outline" route="/admin/freight-loads" />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Freight Connect</Text>
              <Text style={styles.pageTitle}>Freight Carriers</Text>
              <Text style={styles.pageSub}>
                Manage carrier approvals, MC/DOT checks, insurance status, drivers, assigned loads, and revenue.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadCarriers}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Carriers" value={String(stats.total)} icon="business-outline" accent />
              <StatCard label="Approved" value={String(stats.approved)} icon="checkmark-circle-outline" success />
              <StatCard label="Subscribed" value={String(stats.subscribed)} icon="card-outline" />
              <StatCard label="Drivers" value={String(stats.driverCount)} icon="car-outline" />
              <StatCard label="Active Loads" value={String(stats.activeLoads)} icon="cube-outline" />
              <StatCard label="Delivered Loads" value={String(stats.deliveredLoads)} icon="flag-outline" success />
              <StatCard label="Insurance Issues" value={String(stats.insuranceIssues)} icon="warning-outline" danger />
              <StatCard label="Carrier Revenue" value={formatMoney(stats.revenue)} icon="cash-outline" accent />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search company, MC, DOT, owner, email, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Carrier Directory</Text>
                <Text style={styles.sectionLink}>{filteredCarriers.length} records</Text>
              </View>

              <FlatList
                data={filteredCarriers}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No freight carriers found."
                    text="Freight carrier accounts will appear after registration."
                  />
                }
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <View style={styles.avatar}>
                      <Ionicons name="business-outline" size={22} color={ui.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.company_name || "Freight Carrier"}</Text>

                      <Text style={styles.meta}>
                        Contact: {item.owner_name || item.contact_name || "Not provided"}
                      </Text>

                      <Text style={styles.meta}>
                        {item.email || "No email"} • {item.phone || "No phone"}
                      </Text>

                      <Text style={styles.meta}>
                        MC: {item.mc_number || "Not saved"} • DOT: {item.dot_number || "Not saved"}
                      </Text>

                      <Text style={styles.meta}>
                        Insurance: {item.insurance_status || "Not saved"} • Expires:{" "}
                        {formatDate(item.insurance_expiration)}
                      </Text>

                      <Text style={styles.meta}>
                        Loads: {item.acceptedLoads} • Active: {item.activeLoads} • Delivered: {item.deliveredLoads}
                      </Text>

                      <Text style={styles.meta}>
                        Drivers: {item.driverCount} • Revenue: {formatMoney(item.revenue)}
                      </Text>

                      <Text style={styles.meta}>Subscription: {item.subscriptionStatus}</Text>
                    </View>

                    <View style={styles.rightCol}>
                      {renderBadge(item.status)}
                      {renderBadge(item.subscriptionStatus)}
                      {renderBadge(item.insurance_status || "insurance")}

                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() =>
                          Alert.alert(
                            "Carrier Details",
                            `${item.company_name || "Carrier"}\nMC: ${
                              item.mc_number || "Not saved"
                            }\nDOT: ${item.dot_number || "Not saved"}\nInsurance: ${
                              item.insurance_status || "Not saved"
                            }\nLoads: ${item.acceptedLoads}\nRevenue: ${formatMoney(item.revenue)}`
                          )
                        }
                      >
                        <Text style={styles.viewButtonText}>View</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => updateCarrierStatus(item.id, "approved")}
                      >
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => updateCarrierStatus(item.id, "rejected")}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
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
  danger = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  const color = danger ? ui.red : success ? ui.green : accent ? ui.primary : ui.blue;

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
      <Ionicons name="business-outline" size={30} color={ui.primary} />
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
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 760 },
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
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 150,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
    textAlign: "center",
  },
  viewButton: {
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  approveButton: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  approveButtonText: { color: ui.green, fontWeight: "900", fontSize: 12 },
  rejectButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rejectButtonText: { color: ui.red, fontWeight: "900", fontSize: 12 },
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