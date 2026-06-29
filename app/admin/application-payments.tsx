// app/admin/application-payments.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F4F7FB",
  dark: "#07111F",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
  green: "#16A34A",
  greenSoft: "#ECFDF5",
  orange: "#EA580C",
  orangeSoft: "#FFF7ED",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  white: "#FFFFFF",
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
  updated_at?: string | null;
};

type FarmerRecord = {
  id?: string | null;
  farm_name?: string | null;
  business_name?: string | null;
  owner_name?: string | null;
  email?: string | null;
  status?: string | null;
  compliance_status?: string | null;
};

type VerificationRecord = {
  id?: string | null;
  farmer_id?: string | null;
  business_name?: string | null;
  email?: string | null;
  status?: string | null;
};

type PaymentCard = ApplicationPaymentRow & {
  farmerName: string;
  ownerName: string;
  verificationStatus: string;
  farmerStatus: string;
  displayAmount: number;
  reviewReady: boolean;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function isPaid(status?: string | null) {
  return ["paid", "succeeded", "complete", "completed", "paID".toLowerCase()].includes(
    lower(status)
  );
}

function isPending(status?: string | null) {
  return ["pending", "open", "created", "processing"].includes(lower(status));
}

function isFailed(status?: string | null) {
  return ["failed", "cancelled", "canceled", "expired"].includes(lower(status));
}

async function safeRead<T = any>(table: string, select = "*"): Promise<T[]> {
  try {
    const { data, error } = await supabase.from(table).select(select);

    if (error) {
      console.log(`${table} skipped:`, error.message);
      return [];
    }

    return Array.isArray(data) ? (data as T[]) : [];
  } catch (error) {
    console.log(`${table} failed:`, error);
    return [];
  }
}

export default function AdminApplicationPayments() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [payments, setPayments] = useState<PaymentCard[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  async function initialize() {
    const raw = await AsyncStorage.getItem("currentAdmin");

    if (!raw) {
      router.replace("/admin/login" as any);
      return;
    }

    try {
      const admin = JSON.parse(raw);

      if (admin.role !== "admin" || admin.isActive === false) {
        router.replace("/admin/login" as any);
        return;
      }

      setAdminEmail(admin.email || "");
      await loadPayments();
    } catch {
      router.replace("/admin/login" as any);
    }
  }

  async function loadPayments() {
    try {
      setLoading(true);

      const [paymentData, farmerData, verificationData] = await Promise.all([
        safeRead<ApplicationPaymentRow>("farmer_application_payments"),
        safeRead<FarmerRecord>(
          "farmers",
          "id, farm_name, business_name, owner_name, email, status, compliance_status"
        ),
        safeRead<VerificationRecord>(
          "verification_records",
          "id, farmer_id, business_name, email, status"
        ),
      ]);

      const mapped: PaymentCard[] = paymentData.map((payment) => {
        const paymentEmail = lower(payment.email || payment.customer_email);

        const farmer = farmerData.find(
          (item) =>
            clean(item.id) === clean(payment.farmer_id) ||
            lower(item.email) === paymentEmail
        );

        const verification = verificationData.find(
          (item) =>
            clean(item.farmer_id) === clean(payment.farmer_id) ||
            lower(item.email) === paymentEmail
        );

        const displayAmount =
          Number(payment.amount || 0) > 0
            ? Number(payment.amount)
            : Number(payment.amount_cents || 0) > 0
            ? Number(payment.amount_cents) / 100
            : 29.99;

        const verificationStatus =
          clean(verification?.status) ||
          clean(farmer?.compliance_status) ||
          clean(farmer?.status) ||
          "Not reviewed";

        return {
          ...payment,
          farmerName:
            clean(payment.farm_name) ||
            clean(payment.business_name) ||
            clean(farmer?.farm_name) ||
            clean(farmer?.business_name) ||
            clean(verification?.business_name) ||
            "Farmer Applicant",
          ownerName: clean(farmer?.owner_name) || "Owner not provided",
          farmerStatus: clean(farmer?.status) || "Unknown",
          verificationStatus,
          displayAmount,
          reviewReady: isPaid(payment.status),
        };
      });

      mapped.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      );

      setPayments(mapped);
    } catch (error: any) {
      Alert.alert(
        "Application Payments Error",
        error?.message || "Unable to load application payments."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadPayments();
  }

  const filteredPayments = useMemo(() => {
    const q = lower(search);
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
    const paid = payments.filter((payment) => isPaid(payment.status));
    const pending = payments.filter((payment) => isPending(payment.status));
    const failed = payments.filter((payment) => isFailed(payment.status));
    const reviewReady = payments.filter((payment) => payment.reviewReady);

    return {
      total: payments.length,
      paid: paid.length,
      pending: pending.length,
      failed: failed.length,
      reviewReady: reviewReady.length,
      grossRevenue: paid.reduce((sum, payment) => sum + payment.displayAmount, 0),
    };
  }, [payments]);

  async function markPaymentPaid(payment: PaymentCard) {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("farmer_application_payments")
        .update({
          status: "PAID",
          updated_at: now,
        })
        .eq("id", payment.id);

      if (error) throw error;

      setPayments((prev) =>
        prev.map((item) =>
          item.id === payment.id
            ? { ...item, status: "PAID", updated_at: now, reviewReady: true }
            : item
        )
      );

      Alert.alert("Payment Updated", "Application payment was marked as paid.");
    } catch (error: any) {
      Alert.alert("Update Failed", error?.message || "Unable to mark payment paid.");
    }
  }

  function openReview(payment: PaymentCard) {
    router.push({
      pathname: "/admin/verification-records",
      params: {
        farmerId: payment.farmer_id || "",
        email: payment.email || payment.customer_email || "",
      },
    } as any);
  }

  function statusColor(status?: string | null) {
    if (isPaid(status)) return ui.green;
    if (isPending(status)) return ui.orange;
    if (isFailed(status)) return ui.red;
    return ui.primary;
  }

  function statusSoft(status?: string | null) {
    if (isPaid(status)) return ui.greenSoft;
    if (isPending(status)) return ui.orangeSoft;
    if (isFailed(status)) return ui.redSoft;
    return ui.primarySoft;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Unknown date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleString();
  }

  async function logoutAdmin() {
    await AsyncStorage.multiRemove([
      "currentAdmin",
      "currentUser",
      "userRole",
      "currentUserRole",
    ]);

    router.replace("/admin/login" as any);
  }

  if (loading && payments.length === 0) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="light-content" backgroundColor={ui.dark} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading application payments...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={ui.dark} />

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Farm2Home Admin</Text>
            <Text style={styles.title}>Application Payments</Text>
            <Text style={styles.subtitle}>
              Track farmer application fees, Stripe sessions, paid status,
              verification readiness, and gross application revenue.
            </Text>
            <Text style={styles.adminLine}>Logged in: {adminEmail || "Admin"}</Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={logoutAdmin}>
            <Ionicons name="log-out-outline" size={18} color={ui.white} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.moneyCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.moneyLabel}>Gross Application Revenue</Text>
            <Text style={styles.moneyValue}>{money(stats.grossRevenue)}</Text>
            <Text style={styles.moneySub}>
              Paid: {stats.paid} · Pending: {stats.pending} · Failed: {stats.failed}
            </Text>
          </View>

          <View style={styles.moneyIcon}>
            <Ionicons name="card-outline" size={32} color={ui.white} />
          </View>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>Application Payment Flow</Text>
          <FlowStep number="1" text="Farmer submits application and pays the one-time $29.99 fee." />
          <FlowStep number="2" text="Stripe payment status is saved to farmer_application_payments." />
          <FlowStep number="3" text="Paid applications become ready for admin verification review." />
          <FlowStep number="4" text="After approval, farmer membership and store setup continue." />
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Total Payments" value={String(stats.total)} icon="card-outline" color={ui.primary} />
          <StatCard label="Paid" value={String(stats.paid)} icon="checkmark-circle-outline" color={ui.green} />
          <StatCard label="Pending" value={String(stats.pending)} icon="time-outline" color={ui.orange} />
          <StatCard label="Failed" value={String(stats.failed)} icon="close-circle-outline" color={ui.red} />
          <StatCard label="Ready Review" value={String(stats.reviewReady)} icon="shield-checkmark-outline" color={ui.purple} />
        </View>

        <View style={styles.actionsRow}>
          <AdminNav label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <AdminNav label="Verification" icon="shield-checkmark-outline" route="/admin/verification-records" />
          <AdminNav label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <AdminNav label="Revenue" icon="cash-outline" route="/admin/revenue" />
        </View>

        <View style={styles.searchCard}>
          <Ionicons name="search-outline" size={20} color={ui.primary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search farmer, email, Stripe ID, payment status..."
            placeholderTextColor={ui.muted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.ledgerCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Application Fee Ledger</Text>
              <Text style={styles.sectionSub}>
                {filteredPayments.length} record(s) shown
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadPayments}>
              <Ionicons name="refresh-outline" size={17} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredPayments}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <EmptyCard
                title="No application payments found"
                text="Farmer application fee records will appear here after Stripe checkout."
              />
            }
            renderItem={({ item }) => (
              <View style={styles.paymentRow}>
                <View style={[styles.avatar, { backgroundColor: statusSoft(item.status) }]}>
                  <Ionicons
                    name={isPaid(item.status) ? "checkmark-circle-outline" : "card-outline"}
                    size={23}
                    color={statusColor(item.status)}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.farmerName}</Text>
                  <Text style={styles.meta}>Owner: {item.ownerName}</Text>
                  <Text style={styles.meta}>
                    Email: {item.email || item.customer_email || "No email"}
                  </Text>
                  <Text style={styles.meta}>
                    Farmer ID: {item.farmer_id || "Not linked"}
                  </Text>
                  <Text style={styles.meta}>
                    Farmer Status: {item.farmerStatus}
                  </Text>
                  <Text style={styles.meta}>
                    Verification: {item.verificationStatus}
                  </Text>
                  <Text style={styles.meta}>
                    Stripe Session: {item.stripe_session_id || "Not saved"}
                  </Text>
                  <Text style={styles.meta}>
                    Payment Intent: {item.stripe_payment_intent_id || "Not saved"}
                  </Text>
                  <Text style={styles.dateText}>Created: {formatDate(item.created_at)}</Text>
                </View>

                <View style={styles.rightCol}>
                  <Text style={styles.amount}>{money(item.displayAmount)}</Text>

                  <View style={[styles.badge, { backgroundColor: statusColor(item.status) }]}>
                    <Text style={styles.badgeText}>{item.status || "UNKNOWN"}</Text>
                  </View>

                  <View
                    style={[
                      styles.reviewBadge,
                      item.reviewReady ? styles.readyBadge : styles.notReadyBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reviewBadgeText,
                        item.reviewReady ? styles.readyText : styles.notReadyText,
                      ]}
                    >
                      {item.reviewReady ? "Ready Review" : "Not Ready"}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() =>
                      Alert.alert(
                        "Application Payment",
                        `${item.farmerName}\n\nAmount: ${money(
                          item.displayAmount
                        )}\nStatus: ${item.status || "Unknown"}\nFarmer Status: ${
                          item.farmerStatus
                        }\nVerification: ${item.verificationStatus}\nStripe Session: ${
                          item.stripe_session_id || "Not saved"
                        }`
                      )
                    }
                  >
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>

                  {!isPaid(item.status) ? (
                    <TouchableOpacity
                      style={styles.markPaidButton}
                      onPress={() => markPaymentPaid(item)}
                    >
                      <Text style={styles.markPaidText}>Mark Paid</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => openReview(item)}
                  >
                    <Text style={styles.reviewButtonText}>Review</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FlowStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowNumber}>{number}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
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

function AdminNav({
  label,
  icon,
  route,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}) {
  return (
    <TouchableOpacity
      style={styles.navButton}
      onPress={() => router.push(route as any)}
    >
      <Ionicons name={icon} size={17} color={ui.primary} />
      <Text style={styles.navText}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="card-outline" size={34} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.dark },
  page: { flex: 1, backgroundColor: ui.bg },
  content: { padding: 16, paddingBottom: 90 },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: ui.muted, marginTop: 10, fontWeight: "800" },

  hero: {
    backgroundColor: ui.dark,
    borderRadius: 28,
    padding: 22,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
  },
  kicker: {
    color: "#93C5FD",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: { color: ui.white, fontSize: 33, fontWeight: "900", marginTop: 6 },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  adminLine: { color: "#BFDBFE", fontWeight: "800", marginTop: 12 },
  logoutButton: {
    backgroundColor: ui.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  logoutText: { color: ui.white, fontWeight: "900" },

  moneyCard: {
    backgroundColor: ui.primary,
    borderRadius: 26,
    padding: 22,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  moneyLabel: { color: "#DBEAFE", fontWeight: "900" },
  moneyValue: { color: ui.white, fontSize: 42, fontWeight: "900", marginTop: 5 },
  moneySub: { color: "#DBEAFE", fontWeight: "700", marginTop: 6 },
  moneyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  flowCard: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  flowTitle: { color: ui.text, fontSize: 20, fontWeight: "900", marginBottom: 10 },
  flowStep: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 9 },
  flowNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: ui.primarySoft,
    color: ui.primary,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  flowText: { flex: 1, color: ui.text, fontWeight: "800", lineHeight: 20 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard: {
    flexGrow: 1,
    width: "47%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { color: ui.text, fontSize: 23, fontWeight: "900" },
  statLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },

  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  navButton: {
    flexGrow: 1,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  navText: { color: ui.primary, fontWeight: "900" },

  searchCard: {
    backgroundColor: ui.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 54,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },

  ledgerCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { color: ui.text, fontSize: 21, fontWeight: "900" },
  sectionSub: { color: ui.muted, fontWeight: "700", marginTop: 4 },
  refreshPill: {
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  refreshPillText: { color: ui.primary, fontWeight: "900" },

  paymentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: ui.text, fontWeight: "900", fontSize: 17 },
  meta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  dateText: {
    color: ui.primary,
    fontWeight: "800",
    fontSize: 12,
    marginTop: 6,
  },
  rightCol: { alignItems: "flex-end", gap: 8, maxWidth: 150 },
  amount: { color: ui.text, fontWeight: "900", fontSize: 20 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: ui.white,
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
  },
  reviewBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  readyBadge: { backgroundColor: ui.greenSoft },
  notReadyBadge: { backgroundColor: ui.orangeSoft },
  reviewBadgeText: { fontWeight: "900", fontSize: 10 },
  readyText: { color: ui.green },
  notReadyText: { color: ui.orange },
  viewButton: {
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  markPaidButton: {
    backgroundColor: ui.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  markPaidText: { color: ui.green, fontWeight: "900", fontSize: 12 },
  reviewButton: {
    backgroundColor: ui.purpleSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reviewButtonText: { color: ui.purple, fontWeight: "900", fontSize: 12 },

  emptyCard: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
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