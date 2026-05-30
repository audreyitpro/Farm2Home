// app/admin/payouts.tsx

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

type PayoutItem = {
  id: string;
  type: "Farmer Payout" | "Marketplace Payout";
  farmerId?: string | null;
  farmerName: string;
  amount: number;
  status: string;
  stripeAccountId?: string | null;
  stripeTransferId?: string | null;
  orderId?: string | null;
  created_at?: string | null;
};

export default function AdminPayouts() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PayoutItem[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadPayouts();
    }, [])
  );

  async function loadPayouts() {
    try {
      setLoading(true);

      const { data: farmerPayouts } = await supabase
        .from("farmer_payouts")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: marketplacePayouts } = await supabase
        .from("marketplace_payouts")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: farmers } = await supabase
        .from("farmers")
        .select("id, farm_name, owner_name, stripe_account_id");

      const farmerRows = Array.isArray(farmers) ? farmers : [];

      const allItems: PayoutItem[] = [];

      (Array.isArray(farmerPayouts) ? farmerPayouts : []).forEach((payout: any) => {
        const farmer = farmerRows.find(
          (item: any) => String(item.id) === String(payout.farmer_id)
        );

        allItems.push({
          id: `farmer_${payout.id}`,
          type: "Farmer Payout",
          farmerId: payout.farmer_id,
          farmerName:
            payout.farm_name ||
            farmer?.farm_name ||
            farmer?.owner_name ||
            "Farmer",
          amount: Number(
            payout.amount ||
              payout.amount_dollars ||
              Number(payout.amount_cents || 0) / 100 ||
              0
          ),
          status: payout.status || "PENDING",
          stripeAccountId:
            payout.stripe_account_id ||
            payout.farmer_stripe_account_id ||
            farmer?.stripe_account_id ||
            null,
          stripeTransferId: payout.transfer_id || payout.stripe_transfer_id || null,
          orderId: payout.order_id || null,
          created_at: payout.created_at,
        });
      });

      (Array.isArray(marketplacePayouts) ? marketplacePayouts : []).forEach(
        (payout: any) => {
          const farmer = farmerRows.find(
            (item: any) => String(item.id) === String(payout.farmer_id)
          );

          allItems.push({
            id: `marketplace_${payout.id}`,
            type: "Marketplace Payout",
            farmerId: payout.farmer_id,
            farmerName:
              payout.farm_name ||
              farmer?.farm_name ||
              farmer?.owner_name ||
              "Marketplace Farmer",
            amount: Number(
              payout.amount ||
                payout.amount_dollars ||
                Number(payout.amount_cents || 0) / 100 ||
                0
            ),
            status: payout.status || "PENDING",
            stripeAccountId:
              payout.stripe_account_id ||
              payout.farmer_stripe_account_id ||
              farmer?.stripe_account_id ||
              null,
            stripeTransferId: payout.transfer_id || payout.stripe_transfer_id || null,
            orderId: payout.order_id || null,
            created_at: payout.created_at,
          });
        }
      );

      allItems.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setItems(allItems);
    } catch (error: any) {
      Alert.alert("Payouts Error", error?.message || "Unable to load payouts.");
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      [
        item.id,
        item.type,
        item.farmerId,
        item.farmerName,
        item.status,
        item.stripeAccountId,
        item.stripeTransferId,
        item.orderId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const paid = items.filter((item) =>
      ["paid", "complete", "completed", "succeeded", "transferred"].includes(
        String(item.status || "").toLowerCase()
      )
    );

    const pending = items.filter((item) =>
      ["pending", "open", "created", "processing"].includes(
        String(item.status || "").toLowerCase()
      )
    );

    const failed = items.filter((item) =>
      ["failed", "cancelled", "canceled", "reversed"].includes(
        String(item.status || "").toLowerCase()
      )
    );

    return {
      total: items.length,
      paid: paid.length,
      pending: pending.length,
      failed: failed.length,
      paidAmount: paid.reduce((sum, item) => sum + item.amount, 0),
      pendingAmount: pending.reduce((sum, item) => sum + item.amount, 0),
      totalAmount: items.reduce((sum, item) => sum + item.amount, 0),
    };
  }, [items]);

  async function markPayoutPaid(item: PayoutItem) {
    try {
      const table =
        item.type === "Farmer Payout" ? "farmer_payouts" : "marketplace_payouts";
      const rawId = item.id.replace("farmer_", "").replace("marketplace_", "");

      const { error } = await supabase
        .from(table)
        .update({ status: "PAID" })
        .eq("id", rawId);

      if (error) throw error;

      setItems((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, status: "PAID" } : x))
      );
    } catch (error: any) {
      Alert.alert("Update Failed", error?.message || "Unable to mark payout paid.");
    }
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["paid", "complete", "completed", "succeeded", "transferred"].includes(value)) {
      return ui.green;
    }

    if (["pending", "open", "created", "processing"].includes(value)) {
      return ui.orange;
    }

    if (["failed", "cancelled", "canceled", "reversed"].includes(value)) {
      return ui.red;
    }

    return ui.blue;
  }

  function getTypeColor(type: string) {
    if (type === "Farmer Payout") return ui.green;
    return ui.primary;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Unknown date";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Unknown date";
    }
  }

  function renderBadge(label?: string | null, color?: string) {
    return (
      <View style={[styles.badge, { backgroundColor: color || getStatusColor(label) }]}>
        <Text style={styles.badgeText}>{label || "UNKNOWN"}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading payouts...</Text>
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
              <Text style={styles.logoSub}>Payouts</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Revenue" icon="cash-outline" route="/admin/revenue" />
          <NavButton label="Payouts" icon="arrow-redo-outline" route="/admin/payouts" active />
          <NavButton label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <NavButton label="Orders" icon="receipt-outline" route="/admin/orders" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Stripe Connect</Text>
              <Text style={styles.pageTitle}>Payouts</Text>
              <Text style={styles.pageSub}>
                Track farmer payouts, marketplace transfers, Stripe Connect status, and payout failures.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadPayouts}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Payouts" value={String(stats.total)} icon="arrow-redo-outline" accent />
              <StatCard label="Paid" value={String(stats.paid)} icon="checkmark-circle-outline" success />
              <StatCard label="Pending" value={String(stats.pending)} icon="time-outline" warning />
              <StatCard label="Failed" value={String(stats.failed)} icon="close-circle-outline" danger />
              <StatCard label="Total Amount" value={formatMoney(stats.totalAmount)} icon="cash-outline" accent />
              <StatCard label="Paid Amount" value={formatMoney(stats.paidAmount)} icon="wallet-outline" success />
              <StatCard label="Pending Amount" value={formatMoney(stats.pendingAmount)} icon="hourglass-outline" warning />
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="information-circle-outline" size={22} color={ui.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Stripe Connect Reminder</Text>
                <Text style={styles.infoText}>
                  Farmer payouts require a saved Stripe account ID and payouts_enabled=true. If a payout is stuck, verify the farmer completed Stripe onboarding.
                </Text>
              </View>
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search farmer, order ID, Stripe account, transfer ID..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Payout Ledger</Text>
                <Text style={styles.sectionLink}>{filteredItems.length} records</Text>
              </View>

              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No payout records found."
                    text="Marketplace and farmer payout records will appear here after paid orders."
                  />
                }
                renderItem={({ item }) => {
                  const typeColor = getTypeColor(item.type);

                  return (
                    <View style={styles.row}>
                      <View style={[styles.avatar, { backgroundColor: `${typeColor}18` }]}>
                        <Ionicons name="cash-outline" size={22} color={typeColor} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.farmerName}</Text>
                        <Text style={styles.meta}>
                          Type: {item.type} • Amount: {formatMoney(item.amount)}
                        </Text>
                        <Text style={styles.meta}>
                          Farmer ID: {item.farmerId || "Not saved"}
                        </Text>
                        <Text style={styles.meta}>
                          Order ID: {item.orderId || "Not linked"}
                        </Text>
                        <Text style={styles.meta}>
                          Stripe Account: {item.stripeAccountId || "Missing"}
                        </Text>
                        <Text style={styles.meta}>
                          Transfer ID: {item.stripeTransferId || "Not transferred"}
                        </Text>
                        <Text style={styles.meta}>Created: {formatDate(item.created_at)}</Text>
                      </View>

                      <View style={styles.rightCol}>
                        {renderBadge(item.type, typeColor)}
                        {renderBadge(item.status)}

                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() =>
                            Alert.alert(
                              "Payout Details",
                              `${item.farmerName}\nAmount: ${formatMoney(
                                item.amount
                              )}\nStatus: ${item.status}\nStripe Account: ${
                                item.stripeAccountId || "Missing"
                              }\nTransfer: ${item.stripeTransferId || "Not transferred"}`
                            )
                          }
                        >
                          <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.approveButton}
                          onPress={() => markPayoutPaid(item)}
                        >
                          <Text style={styles.approveButtonText}>Mark Paid</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
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
  danger = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  const color = danger
    ? ui.red
    : warning
    ? ui.orange
    : success
    ? ui.green
    : accent
    ? ui.primary
    : ui.blue;

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
      <Ionicons name="cash-outline" size={30} color={ui.primary} />
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
  infoCard: {
    backgroundColor: ui.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: { color: ui.text, fontWeight: "900", fontSize: 16 },
  infoText: { color: ui.muted, fontWeight: "700", lineHeight: 20, marginTop: 4 },
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
    maxWidth: 160,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 9,
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