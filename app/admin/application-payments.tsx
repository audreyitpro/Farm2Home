// app/admin/application-payments.tsx

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

type ApplicationPaymentRow = {
  id: string;
  farmer_id?: string | null;
  email?: string | null;
  customer_email?: string | null;
  business_name?: string | null;
  farm_name?: string | null;
  amount?: number | null;
  amount_cents?: number | null;
  status?: string | null;
  stripe_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  created_at?: string | null;
};

type FarmerRow = {
  id: string;
  farm_name?: string | null;
  owner_name?: string | null;
  email?: string | null;
  status?: string | null;
};

type VerificationRow = {
  id: string;
  farmer_id?: string | null;
  business_name?: string | null;
  email?: string | null;
  status?: string | null;
};

type PaymentCard = ApplicationPaymentRow & {
  farmerName: string;
  ownerName: string;
  verificationStatus: string;
  displayAmount: number;
};

export default function AdminApplicationPayments() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentCard[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadPayments();
    }, [])
  );

  async function loadPayments() {
    try {
      setLoading(true);

      const { data: paymentData } = await supabase
        .from("farmer_application_payments")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: farmerData } = await supabase
        .from("farmers")
        .select("id, farm_name, owner_name, email, status");

      const { data: verificationData } = await supabase
        .from("verification_records")
        .select("id, farmer_id, business_name, email, status");

      const cleanPayments = Array.isArray(paymentData)
        ? (paymentData as ApplicationPaymentRow[])
        : [];

      const farmers = Array.isArray(farmerData) ? (farmerData as FarmerRow[]) : [];
      const verifications = Array.isArray(verificationData)
        ? (verificationData as VerificationRow[])
        : [];

      const mapped: PaymentCard[] = cleanPayments.map((payment) => {
        const farmer = farmers.find(
          (item) => String(item.id) === String(payment.farmer_id)
        );

        const verification = verifications.find(
          (item) =>
            String(item.farmer_id || "") === String(payment.farmer_id || "") ||
            String(item.email || "").toLowerCase() ===
              String(payment.email || payment.customer_email || "").toLowerCase()
        );

        const displayAmount =
          Number(payment.amount || 0) > 0
            ? Number(payment.amount || 0)
            : Number(payment.amount_cents || 0) / 100 || 29.99;

        return {
          ...payment,
          farmerName:
            payment.farm_name ||
            payment.business_name ||
            farmer?.farm_name ||
            verification?.business_name ||
            "Farmer Applicant",
          ownerName: farmer?.owner_name || "Owner not provided",
          verificationStatus: verification?.status || farmer?.status || "unknown",
          displayAmount,
        };
      });

      setPayments(mapped);
    } catch (error: any) {
      Alert.alert(
        "Application Payments Error",
        error?.message || "Unable to load application payments."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;

    return payments.filter((payment) =>
      [
        payment.id,
        payment.farmer_id,
        payment.email,
        payment.customer_email,
        payment.farmerName,
        payment.ownerName,
        payment.status,
        payment.verificationStatus,
        payment.stripe_session_id,
        payment.stripe_payment_intent_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [payments, search]);

  const stats = useMemo(() => {
    const paid = payments.filter((payment) =>
      ["paid", "PAID", "succeeded", "SUCCEEDED", "complete", "COMPLETE"].includes(
        String(payment.status || "")
      )
    );

    const pending = payments.filter((payment) =>
      ["pending", "PENDING", "open", "OPEN", "created", "CREATED"].includes(
        String(payment.status || "")
      )
    );

    const failed = payments.filter((payment) =>
      ["failed", "FAILED", "cancelled", "CANCELLED", "canceled", "CANCELED"].includes(
        String(payment.status || "")
      )
    );

    return {
      total: payments.length,
      paid: paid.length,
      pending: pending.length,
      failed: failed.length,
      revenue: paid.reduce((sum, payment) => sum + payment.displayAmount, 0),
    };
  }, [payments]);

  async function markPaymentPaid(paymentId: string) {
    try {
      const { error } = await supabase
        .from("farmer_application_payments")
        .update({ status: "PAID" })
        .eq("id", paymentId);

      if (error) throw error;

      setPayments((prev) =>
        prev.map((item) =>
          item.id === paymentId ? { ...item, status: "PAID" } : item
        )
      );
    } catch (error: any) {
      Alert.alert("Update Failed", error?.message || "Unable to mark payment paid.");
    }
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["paid", "succeeded", "complete"].includes(value)) return ui.green;
    if (["pending", "open", "created"].includes(value)) return ui.orange;
    if (["failed", "cancelled", "canceled"].includes(value)) return ui.red;

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
    if (!value) return "Unknown date";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Unknown date";
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading application payments...</Text>
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
              <Text style={styles.logoSub}>Application Fees</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Application Fees" icon="card-outline" route="/admin/application-payments" active />
          <NavButton label="Verification" icon="shield-checkmark-outline" route="/admin/verification-records" />
          <NavButton label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <NavButton label="Revenue" icon="cash-outline" route="/admin/revenue" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Compliance Payments</Text>
              <Text style={styles.pageTitle}>Application Payments</Text>
              <Text style={styles.pageSub}>
                Track the $29.99 farmer application fee, Stripe sessions, payment status, and review readiness.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadPayments}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Payments" value={String(stats.total)} icon="card-outline" accent />
              <StatCard label="Paid" value={String(stats.paid)} icon="checkmark-circle-outline" success />
              <StatCard label="Pending" value={String(stats.pending)} icon="time-outline" warning />
              <StatCard label="Failed / Cancelled" value={String(stats.failed)} icon="close-circle-outline" danger />
              <StatCard label="Application Revenue" value={formatMoney(stats.revenue)} icon="cash-outline" accent />
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="information-circle-outline" size={22} color={ui.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Farmer Application Fee</Text>
                <Text style={styles.infoText}>
                  Farmers pay a one-time $29.99 application processing fee before admin review. Monthly farmer membership should begin only after approval.
                </Text>
              </View>
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search farmer, email, Stripe session, payment status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Application Fee Ledger</Text>
                <Text style={styles.sectionLink}>{filteredPayments.length} records</Text>
              </View>

              <FlatList
                data={filteredPayments}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No application payments found."
                    text="Farmer application fee records will appear after checkout sessions are completed."
                  />
                }
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <View style={styles.avatar}>
                      <Ionicons name="card-outline" size={22} color={ui.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.farmerName}</Text>
                      <Text style={styles.meta}>
                        Owner: {item.ownerName} • Amount: {formatMoney(item.displayAmount)}
                      </Text>
                      <Text style={styles.meta}>
                        Email: {item.email || item.customer_email || "No email"}
                      </Text>
                      <Text style={styles.meta}>
                        Verification: {item.verificationStatus}
                      </Text>
                      <Text style={styles.meta}>
                        Stripe Session: {item.stripe_session_id || "Not saved"}
                      </Text>
                      <Text style={styles.meta}>
                        Created: {formatDate(item.created_at)}
                      </Text>
                    </View>

                    <View style={styles.rightCol}>
                      {renderBadge(item.status)}

                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() =>
                          Alert.alert(
                            "Application Payment",
                            `${item.farmerName}\nAmount: ${formatMoney(
                              item.displayAmount
                            )}\nStatus: ${item.status || "Unknown"}\nStripe Session: ${
                              item.stripe_session_id || "Not saved"
                            }`
                          )
                        }
                      >
                        <Text style={styles.viewButtonText}>View</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => markPaymentPaid(item.id)}
                      >
                        <Text style={styles.approveButtonText}>Mark Paid</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => router.push("/admin/verification-records" as any)}
                      >
                        <Text style={styles.reviewButtonText}>Review</Text>
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
      <Ionicons name="card-outline" size={30} color={ui.primary} />
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
  reviewButton: {
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reviewButtonText: { color: ui.blue, fontWeight: "900", fontSize: 12 },
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