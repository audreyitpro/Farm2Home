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
  profile_id?: string | null;
  farmer_id?: string | null;
  auth_user_id?: string | null;
  account_id?: string | null;

  farm_name?: string | null;
  business_name?: string | null;
  owner_name?: string | null;
  username?: string | null;

  email?: string | null;
  farmer_email?: string | null;
  phone?: string | null;

  business_address?: string | null;
  farm_location?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;

  approved?: boolean | null;
  account_active?: boolean | null;
  rejected?: boolean | null;
  reviewed?: boolean | null;
  needs_more_info?: boolean | null;
  admin_review_status?: string | null;
  review_decision?: string | null;
  verification_status?: string | null;
  compliance_status?: string | null;
  has_completed_compliance?: boolean | null;

  farmer_membership_paid?: boolean | null;
  farmer_monthly_subscription_paid?: boolean | null;
  monthly_membership_started?: boolean | null;
  membership_status?: string | null;
  subscription_status?: string | null;

  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_id?: string | null;
  stripe_account_id?: string | null;
  farmer_stripe_account_id?: string | null;
  stripe_connect_status?: string | null;
  stripe_onboarding_complete?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  charges_enabled?: boolean | null;

  store_active?: boolean | null;
  marketplace_visible?: boolean | null;
  store_unlocked?: boolean | null;

  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

type OrderRow = {
  id: string;
  farmer_id?: string | null;
  total?: number | null;
  status?: string | null;
};

type FarmerCard = FarmerRow & {
  revenue: number;
  orderCount: number;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function farmerEmail(farmer: FarmerRow) {
  return clean(farmer.farmer_email || farmer.email);
}

function farmerName(farmer: FarmerRow) {
  return clean(farmer.farm_name || farmer.business_name) || "Farm";
}

function membershipStatus(farmer: FarmerRow) {
  return (
    clean(farmer.membership_status) ||
    clean(farmer.subscription_status) ||
    (farmer.farmer_membership_paid === true ? "active" : "none")
  );
}

function subscriptionStatus(farmer: FarmerRow) {
  return clean(farmer.subscription_status) || "none";
}

function verificationStatus(farmer: FarmerRow) {
  return (
    clean(farmer.verification_status) ||
    clean(farmer.admin_review_status) ||
    clean(farmer.review_decision) ||
    clean(farmer.compliance_status) ||
    (farmer.approved === true ? "approved" : "unknown")
  );
}

function isSubscribed(farmer: FarmerRow) {
  const status = lower(farmer.subscription_status || farmer.membership_status);

  return (
    farmer.farmer_membership_paid === true ||
    farmer.farmer_monthly_subscription_paid === true ||
    farmer.monthly_membership_started === true ||
    ["active", "trialing", "past_due", "paid"].includes(status)
  );
}

function isCancellationScheduled(farmer: FarmerRow) {
  return farmer.cancel_at_period_end === true;
}

function matchesFarmerOrder(orderFarmerId: any, farmer: FarmerRow) {
  const orderId = clean(orderFarmerId);
  if (!orderId) return false;

  const possibleIds = [
    farmer.id,
    farmer.farmer_id,
    farmer.profile_id,
    farmer.auth_user_id,
    farmer.account_id,
  ]
    .map(clean)
    .filter(Boolean);

  return possibleIds.includes(orderId);
}

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

      // The farmers table is the source of truth for profile, account,
      // approval, membership, subscription, Stripe, and cancellation state.
      // Only active farmer profiles belong in this admin directory.
      const { data: farmerData, error: farmerError } = await supabase
        .from("farmers")
        .select("*")
        .eq("account_active", true)
        .order("created_at", { ascending: false });

      if (farmerError) {
        throw farmerError;
      }

      // Orders are used only to calculate order count and revenue.
      // They are not used to determine whether a farmer is active.
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("id, farmer_id, total, status");

      if (orderError) {
        console.log("orders load skipped:", orderError.message);
      }

      const activeFarmers = Array.isArray(farmerData)
        ? (farmerData as FarmerRow[])
        : [];

      const orders = Array.isArray(orderData)
        ? (orderData as OrderRow[])
        : [];

      const mapped: FarmerCard[] = activeFarmers.map((farmer) => {
        const farmerOrders = orders.filter((order) =>
          matchesFarmerOrder(order.farmer_id, farmer)
        );

        return {
          ...farmer,
          revenue: farmerOrders.reduce(
            (sum, order) => sum + Number(order.total || 0),
            0
          ),
          orderCount: farmerOrders.length,
        };
      });

      setFarmers(mapped);
    } catch (error: any) {
      console.log("loadFarmers error:", error);
      setFarmers([]);
      Alert.alert(
        "Farmers Error",
        error?.message || "Unable to load active farmers."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredFarmers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return farmers;

    return farmers.filter((farmer) =>
      [
        farmer.account_id,
        farmer.farmer_id,
        farmer.farm_name,
        farmer.business_name,
        farmer.owner_name,
        farmer.username,
        farmer.email,
        farmer.farmer_email,
        farmer.phone,
        farmer.city,
        farmer.state,
        farmer.membership_status,
        farmer.subscription_status,
        farmer.verification_status,
        farmer.admin_review_status,
        farmer.compliance_status,
        farmer.stripe_connect_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [farmers, search]);

  const stats = useMemo(() => {
    const revenue = farmers.reduce(
      (sum, farmer) => sum + farmer.revenue,
      0
    );

    const approved = farmers.filter(
      (farmer) =>
        farmer.approved === true ||
        ["approved", "active"].includes(
          lower(
            farmer.verification_status ||
              farmer.admin_review_status ||
              farmer.review_decision
          )
        )
    ).length;

    const subscribed = farmers.filter(isSubscribed).length;

    const cancellationScheduled = farmers.filter(
      isCancellationScheduled
    ).length;

    return {
      active: farmers.length,
      approved,
      subscribed,
      cancellationScheduled,
      revenue,
    };
  }, [farmers]);

  function getStatusColor(status?: string | null) {
    const value = lower(status);

    if (
      ["approved", "active", "paid", "verified", "trialing"].includes(value)
    ) {
      return ui.green;
    }

    if (
      [
        "pending",
        "pending_admin_review",
        "documents_submitted",
        "past_due",
        "needs_more_info",
      ].includes(value)
    ) {
      return ui.orange;
    }

    if (
      [
        "rejected",
        "suspended",
        "cancelled",
        "canceled",
        "inactive",
        "unpaid",
      ].includes(value)
    ) {
      return ui.red;
    }

    return ui.blue;
  }

  function renderBadge(status?: string | null) {
    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: getStatusColor(status) },
        ]}
      >
        <Text style={styles.badgeText}>
          {clean(status) || "UNKNOWN"}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>
          Loading active farmers...
        </Text>
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

          <NavButton
            label="Dashboard"
            icon="grid-outline"
            route="/admin/dashboard"
          />
          <NavButton
            label="Control Tower"
            icon="radio-outline"
            route="/admin/control-tower"
          />
          <NavButton
            label="Farmers"
            icon="leaf-outline"
            route="/admin/farmers"
            active
          />
          <NavButton
            label="Customers"
            icon="people-outline"
            route="/admin/customers"
          />
          <NavButton
            label="Orders"
            icon="receipt-outline"
            route="/admin/orders"
          />
          <NavButton
            label="Documents"
            icon="document-text-outline"
            route="/admin/documents"
          />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View style={styles.topbarText}>
              <Text style={styles.welcome}>Farm2Home Admin</Text>
              <Text style={styles.pageTitle}>Active Farmers</Text>
              <Text style={styles.pageSub}>
                Active farmer accounts from the farmers table, including
                membership, subscription, account ID, and marketplace revenue.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.refreshPill}
              onPress={loadFarmers}
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color={ui.primary}
              />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard
                label="Active Farmers"
                value={String(stats.active)}
                icon="leaf-outline"
                accent
              />
              <StatCard
                label="Approved"
                value={String(stats.approved)}
                icon="checkmark-circle-outline"
                success
              />
              <StatCard
                label="Active Memberships"
                value={String(stats.subscribed)}
                icon="card-outline"
                success
              />
              <StatCard
                label="Cancellation Scheduled"
                value={String(stats.cancellationScheduled)}
                icon="time-outline"
                warning
              />
              <StatCard
                label="Farmer Revenue"
                value={formatMoney(stats.revenue)}
                icon="cash-outline"
                accent
              />
            </View>

            <View style={styles.searchCard}>
              <Ionicons
                name="search-outline"
                size={20}
                color={ui.primary}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search account ID, farm, owner, email, membership..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Active Farmer Directory
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    account_active = true
                  </Text>
                </View>

                <Text style={styles.sectionLink}>
                  {filteredFarmers.length} records
                </Text>
              </View>

              <FlatList
                data={filteredFarmers}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No active farmers found."
                    text="Only farmer rows with account_active = true appear here."
                  />
                }
                renderItem={({ item }) => {
                  const membership = membershipStatus(item);
                  const subscription = subscriptionStatus(item);
                  const verification = verificationStatus(item);
                  const email = farmerEmail(item);
                  const periodEnd = formatDate(item.current_period_end);

                  return (
                    <View style={styles.row}>
                      <View style={styles.avatar}>
                        <Ionicons
                          name="leaf-outline"
                          size={22}
                          color={ui.primary}
                        />
                      </View>

                      <View style={styles.farmerInfo}>
                        <View style={styles.nameLine}>
                          <Text style={styles.name}>
                            {farmerName(item)}
                          </Text>

                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>
                              ACTIVE
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.accountText}>
                          Account:{" "}
                          {clean(item.account_id) ||
                            "No account assigned"}
                        </Text>

                        <Text style={styles.meta}>
                          Owner:{" "}
                          {clean(item.owner_name) || "Not provided"}
                        </Text>

                        <Text style={styles.meta}>
                          {email || "No email"} •{" "}
                          {clean(item.phone) || "No phone"}
                        </Text>

                        {(item.city || item.state) && (
                          <Text style={styles.meta}>
                            Location:{" "}
                            {[item.city, item.state]
                              .filter(Boolean)
                              .join(", ")}
                          </Text>
                        )}

                        <Text style={styles.meta}>
                          Orders: {item.orderCount} • Revenue:{" "}
                          {formatMoney(item.revenue)}
                        </Text>

                        <View style={styles.detailGrid}>
                          <Detail
                            label="Membership"
                            value={membership}
                          />
                          <Detail
                            label="Subscription"
                            value={subscription}
                          />
                          <Detail
                            label="Verification"
                            value={verification}
                          />
                          <Detail
                            label="Store"
                            value={
                              item.store_active === true
                                ? "active"
                                : "inactive"
                            }
                          />
                        </View>

                        {item.cancel_at_period_end === true && (
                          <View style={styles.cancelNotice}>
                            <Ionicons
                              name="time-outline"
                              size={15}
                              color={ui.orange}
                            />
                            <Text style={styles.cancelNoticeText}>
                              Cancellation scheduled
                              {periodEnd
                                ? ` • Access through ${periodEnd}`
                                : ""}
                            </Text>
                          </View>
                        )}

                        {!!clean(item.stripe_subscription_id) && (
                          <Text style={styles.stripeMeta}>
                            Stripe Subscription:{" "}
                            {clean(item.stripe_subscription_id)}
                          </Text>
                        )}
                      </View>

                      <View style={styles.rightCol}>
                        {renderBadge(verification)}

                        {renderBadge(membership)}

                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() =>
                            router.push("/admin/documents" as any)
                          }
                        >
                          <Text style={styles.viewButtonText}>
                            Review
                          </Text>
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

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || "unknown"}</Text>
    </View>
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
      <Ionicons
        name={icon}
        size={18}
        color={active ? "#FFFFFF" : ui.muted}
      />
      <Text
        style={[styles.navText, active && styles.navTextActive]}
      >
        {label}
      </Text>
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
  const color = success
    ? ui.green
    : warning
      ? ui.orange
      : accent
        ? ui.primary
        : ui.blue;

  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.statIcon,
          { backgroundColor: `${color}18` },
        ]}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons
        name="leaf-outline"
        size={30}
        color={ui.primary}
      />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: ui.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  shell: {
    flex: 1,
    backgroundColor: ui.bg,
  },
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
    gap: 16,
  },
  topbarText: {
    flex: 1,
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
  pageSub: {
    color: ui.muted,
    marginTop: 4,
    fontWeight: "700",
    maxWidth: 720,
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
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: ui.muted,
    fontWeight: "800",
    marginTop: 4,
  },
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
  searchInput: {
    flex: 1,
    color: ui.text,
    fontWeight: "800",
  },
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
  sectionTitle: {
    color: ui.text,
    fontSize: 19,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: ui.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 3,
  },
  sectionLink: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 12,
  },
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
  farmerInfo: {
    flex: 1,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  name: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 16,
  },
  activePill: {
    backgroundColor: "#D1FAE5",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activePillText: {
    color: "#047857",
    fontWeight: "900",
    fontSize: 9,
  },
  accountText: {
    color: ui.primary,
    fontWeight: "900",
    marginTop: 5,
    fontSize: 12,
  },
  meta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 9,
  },
  detailItem: {
    backgroundColor: ui.soft,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    minWidth: 105,
  },
  detailLabel: {
    color: ui.muted,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  detailValue: {
    color: ui.text,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  cancelNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
    backgroundColor: "#FFF7ED",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  cancelNoticeText: {
    color: "#C2410C",
    fontWeight: "800",
    fontSize: 11,
  },
  stripeMeta: {
    color: ui.muted,
    fontWeight: "600",
    fontSize: 10,
    marginTop: 7,
  },
  rightCol: {
    alignItems: "flex-end",
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
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
  viewButtonText: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 12,
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
