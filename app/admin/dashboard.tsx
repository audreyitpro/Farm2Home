// app/admin/dashboard.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getAdminSession,
  getPendingVerificationRecords,
  getVerificationQueue,
  logoutAdmin,
  upsertVerificationRecord,
} from "../data/adminStore";

import { updateFarmerStore } from "../data/farmerStore";

type VerificationRecord = any;

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

const QUEUE_KEYS = ["farm2homeVerificationQueue", "adminVerificationQueue"];
const FARMER_KEYS = ["farm2homeFarmers", "farmers", "approvedFarmers"];

const APPROVAL_EMAIL_WORDING = `Congratulations!

Your Farm2Home farmer application has been approved. Welcome to the Farm2Home family.

You can now log in and set up your farmer market store, add products, manage orders, and start selling to customers in your community.

Next step:
Log in to your Farm2Home farmer account and complete your store setup.

Thank you for joining Farm2Home.`;

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [pendingRecords, setPendingRecords] = useState<VerificationRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [farmerCount, setFarmerCount] = useState(0);
  const [freightCount, setFreightCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  function normalizeStatus(value: any) {
    return String(value || "").trim().toLowerCase();
  }

  function isApproved(item: any) {
    const status = normalizeStatus(item.status);
    const review = normalizeStatus(item.adminReviewStatus);
    return item.approved === true || status === "approved" || status === "approved_verification" || review === "approved";
  }

  function isRejected(item: any) {
    const status = normalizeStatus(item.status);
    const review = normalizeStatus(item.adminReviewStatus);
    return item.rejected === true || status === "rejected" || review === "rejected";
  }

  function isPending(item: any) {
    return !isApproved(item) && !isRejected(item);
  }

  function getFarmerId(record: any) {
    return String(record?.farmerId || record?.id || record?.farmer_id || "");
  }

  function getBusinessName(record: any) {
    return record?.businessName || record?.farmName || record?.farm_name || "Farm2Home Farm";
  }

  function getOwnerName(record: any) {
    return record?.ownerName || record?.owner_name || "Farmer";
  }

  function getEmail(record: any) {
    return String(record?.email || record?.farmerEmail || "").toLowerCase();
  }

  function getAccountType(record: any) {
    return String(record?.accountType || record?.account_type || "FARMER");
  }

  async function readArray(key: string) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function writeArray(key: string, value: any[]) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }

  async function upsertInArrayStorage(key: string, record: any) {
    const id = getFarmerId(record);
    const email = getEmail(record);
    const current = await readArray(key);

    const next = [
      record,
      ...current.filter((item: any) => getFarmerId(item) !== id && getEmail(item) !== email),
    ];

    await writeArray(key, next);
  }

  async function updateQueueRecord(updatedRecord: any) {
    for (const key of QUEUE_KEYS) {
      const current = await readArray(key);

      const next = current.map((item: any) => {
        const sameId = getFarmerId(item) === getFarmerId(updatedRecord);
        const sameEmail = getEmail(item) === getEmail(updatedRecord);
        return sameId || sameEmail ? { ...item, ...updatedRecord } : item;
      });

      const exists = current.some(
        (item: any) =>
          getFarmerId(item) === getFarmerId(updatedRecord) ||
          getEmail(item) === getEmail(updatedRecord)
      );

      await writeArray(key, exists ? next : [updatedRecord, ...current]);
    }
  }

  async function sendFarmerApprovalEmail(record: any) {
    try {
      const email = getEmail(record);
      if (!email || !email.includes("@")) return;

      await fetch("http://10.0.0.216:4242/email/send-farmer-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          businessName: getBusinessName(record),
        }),
      });
    } catch (error) {
      console.log("Approval email skipped:", error);
    }
  }

  async function saveApprovedFarmer(record: any) {
    const farmerId = getFarmerId(record);
    const approvedAt = new Date().toISOString();

    const approvedFarmer = {
      ...record,
      id: farmerId,
      farmerId,
      farmName: getBusinessName(record),
      businessName: getBusinessName(record),
      ownerName: getOwnerName(record),
      email: getEmail(record),
      approved: true,
      rejected: false,
      reviewed: true,
      needsMoreInfo: false,
      accountActive: true,
      storeUnlocked: true,
      complianceSubmitted: true,
      complianceStatus: "approved",
      adminReviewStatus: "approved",
      reviewDecision: "approved",
      status: "APPROVED",
      membershipStatus: "Active",
      subscriptionStatus: "active",
      farmerMembershipPaid: true,
      monthlyMembershipStarted: true,
      approvalEmailQueued: true,
      approvalEmailText: APPROVAL_EMAIL_WORDING,
      approvedAt,
      reviewedAt: approvedAt,
      updatedAt: approvedAt,
    };

    await updateFarmerStore(farmerId, approvedFarmer as any);

    for (const key of FARMER_KEYS) {
      await upsertInArrayStorage(key, approvedFarmer);
    }

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(approvedFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(approvedFarmer));
    await AsyncStorage.setItem("userRole", "farmer");
    await AsyncStorage.setItem("currentUserRole", "farmer");

    await updateQueueRecord(approvedFarmer);

    try {
      await upsertVerificationRecord(approvedFarmer as any);
    } catch (error) {
      console.log("upsertVerificationRecord approve skipped:", error);
    }

    await sendFarmerApprovalEmail(approvedFarmer);
    return approvedFarmer;
  }

  async function approveRecord(record: VerificationRecord) {
    try {
      const farmerId = getFarmerId(record);
      if (!farmerId) {
        Alert.alert("Missing Farmer ID", "Unable to approve this record.");
        return;
      }

      setActionLoadingId(farmerId);
      await saveApprovedFarmer(record);

      Alert.alert(
        "Farmer Approved",
        "The farmer account is approved, active, unlocked, and approval email was triggered."
      );

      await loadDashboard();
    } catch (error: any) {
      Alert.alert("Approval Error", error?.message || "Unable to approve farmer.");
    } finally {
      setActionLoadingId("");
    }
  }

  async function rejectRecord(record: VerificationRecord) {
    try {
      const farmerId = getFarmerId(record);
      const rejectedAt = new Date().toISOString();

      if (!farmerId) {
        Alert.alert("Missing Farmer ID", "Unable to reject this record.");
        return;
      }

      setActionLoadingId(farmerId);

      const rejectedRecord = {
        ...record,
        id: farmerId,
        farmerId,
        approved: false,
        rejected: true,
        reviewed: true,
        needsMoreInfo: false,
        accountActive: false,
        storeUnlocked: false,
        status: "REJECTED",
        complianceStatus: "rejected",
        adminReviewStatus: "rejected",
        reviewDecision: "rejected",
        rejectedAt,
        reviewedAt: rejectedAt,
        updatedAt: rejectedAt,
      };

      await updateFarmerStore(farmerId, rejectedRecord as any);
      await updateQueueRecord(rejectedRecord);

      try {
        await upsertVerificationRecord(rejectedRecord as any);
      } catch (error) {
        console.log("upsertVerificationRecord reject skipped:", error);
      }

      Alert.alert("Rejected", "The application was rejected.");
      await loadDashboard();
    } catch (error: any) {
      Alert.alert("Reject Error", error?.message || "Unable to reject farmer.");
    } finally {
      setActionLoadingId("");
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true);

      const session = await getAdminSession();
      if (!session) {
        router.replace("/admin/login" as any);
        return;
      }

      setAdminEmail(session.email || "");

      const fullQueue = await getVerificationQueue();
      const pending = await getPendingVerificationRecords();

      const finalQueue = Array.isArray(fullQueue) ? fullQueue : [];
      const finalPending =
        Array.isArray(pending) && pending.length > 0
          ? pending
          : finalQueue.filter(isPending);

      setPendingRecords(finalPending);
      setPendingCount(finalPending.length);
      setApprovedCount(finalQueue.filter(isApproved).length);
      setRejectedCount(finalQueue.filter(isRejected).length);
      setFarmerCount(finalQueue.filter((item) => getAccountType(item) === "FARMER").length);
      setFreightCount(finalQueue.filter((item) => getAccountType(item) === "FREIGHT_CARRIER").length);
    } catch (error) {
      console.log("Admin dashboard load error:", error);
      Alert.alert("Dashboard Error", "Unable to load admin dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function refreshDashboard() {
    setRefreshing(true);
    await loadDashboard();
  }

  async function signOut() {
    try {
      await logoutAdmin();
    } catch {}
    router.replace("/admin/login" as any);
  }

  const productionStatus = useMemo(() => {
    if (pendingCount > 0) return "Manual reviews pending";
    return "Operational";
  }, [pendingCount]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading Farm2Home admin dashboard...</Text>
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
              <Text style={styles.logoSub}>Admin Portal</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" active />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
          <NavButton label="Revenue" icon="cash-outline" route="/admin/revenue" />
          <NavButton label="Settings" icon="settings-outline" route="/admin/admin-settings" />
        </View>

        <View style={styles.main}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />}
          >
            <View style={styles.topbar}>
              <View>
                <Text style={styles.welcome}>Welcome back, Admin</Text>
                <Text style={styles.pageTitle}>Admin Dashboard</Text>
                <Text style={styles.pageSub}>
                  Monitor approvals, marketplace operations, freight activity, payouts, subscriptions, and system health.
                </Text>
              </View>

              <TouchableOpacity style={styles.refreshPill} onPress={refreshDashboard}>
                <Ionicons name="refresh-outline" size={18} color={ui.primary} />
                <Text style={styles.refreshPillText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.adminCard}>
              <View style={styles.adminIcon}>
                <Ionicons name="shield-checkmark-outline" size={24} color={ui.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminLabel}>Logged in as</Text>
                <Text style={styles.adminEmail}>{adminEmail || "Administrator"}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: pendingCount > 0 ? ui.orange : ui.green }]}>
                <Text style={styles.statusBadgeText}>{productionStatus}</Text>
              </View>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroIcon}>
                <Ionicons name="shield-checkmark-outline" size={28} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Production Status</Text>
                <Text style={styles.heroText}>
                  {pendingCount > 0
                    ? `${pendingCount} applications require admin review.`
                    : "All core admin operations are ready."}
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <StatCard label="Pending Reviews" value={String(pendingCount)} icon="time-outline" warning />
              <StatCard label="Approved" value={String(approvedCount)} icon="checkmark-circle-outline" success />
              <StatCard label="Rejected" value={String(rejectedCount)} icon="close-circle-outline" danger />
              <StatCard label="Farmers" value={String(farmerCount)} icon="leaf-outline" success />
              <StatCard label="Freight" value={String(freightCount)} icon="trail-sign-outline" />
              <StatCard label="AI Compliance" value="Ready" icon="sparkles-outline" accent />
            </View>

            <View style={styles.quickGrid}>
              <QuickAction label="Accounts" icon="people-outline" route="/admin/accounts" />
              <QuickAction label="Documents" icon="document-text-outline" route="/admin/documents" />
              <QuickAction label="Revenue" icon="cash-outline" route="/admin/revenue" />
              <QuickAction label="Fleet Map" icon="map-outline" route="/admin/fleet-map" />
              <QuickAction label="System Audit" icon="shield-checkmark-outline" route="/admin/system-audit" />
              <QuickAction label="Platform Health" icon="pulse-outline" route="/admin/platform-health" />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pending Farmer Approvals</Text>
                <Text style={styles.sectionLink}>{pendingRecords.length} records</Text>
              </View>

              {pendingRecords.length === 0 ? (
                <EmptyCard
                  title="No pending applications."
                  text="Approved accounts can log in and continue store setup."
                />
              ) : (
                pendingRecords.map((record) => {
                  const id = getFarmerId(record);
                  const actionLoading = actionLoadingId === id;

                  return (
                    <View key={id || getEmail(record)} style={styles.reviewCard}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewIcon}>
                          <Ionicons name="leaf-outline" size={22} color={ui.primary} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewTitle}>{getBusinessName(record)}</Text>
                          <Text style={styles.meta}>Owner: {getOwnerName(record)}</Text>
                          <Text style={styles.meta}>Email: {getEmail(record)}</Text>
                          <Text style={styles.meta}>
                            Status: {record.status || record.complianceStatus || "Pending"}
                          </Text>
                        </View>

                        <View style={[styles.statusBadge, { backgroundColor: ui.orange }]}>
                          <Text style={styles.statusBadgeText}>Pending</Text>
                        </View>
                      </View>

                      <View style={styles.reviewButtonRow}>
                        <TouchableOpacity
                          style={[styles.approveButton, actionLoading && styles.disabled]}
                          disabled={actionLoading}
                          onPress={() => approveRecord(record)}
                        >
                          {actionLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                              <Text style={styles.reviewButtonText}>Approve & Unlock</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.rejectButton, actionLoading && styles.disabled]}
                          disabled={actionLoading}
                          onPress={() => rejectRecord(record)}
                        >
                          <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.reviewButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.actionGrid}>
              <AdminActionCard
                icon="shield-checkmark-outline"
                title="AI Compliance Queue"
                description="Review farmer and freight applications, Stripe onboarding status, uploaded documents, and final approval."
                route="/admin/documents"
              />
              <AdminActionCard
                icon="document-text-outline"
                title="Compliance Review"
                description="Review verification findings, missing documents, and business validation checks."
                route="/admin/compliance-review"
              />
              <AdminActionCard
                icon="radio-outline"
                title="Live Operations"
                description="Monitor deliveries, drivers, routes, freight operations, and fulfillment activity."
                route="/admin/live-operations-center"
              />
              <AdminActionCard
                icon="analytics-outline"
                title="Analytics Center"
                description="Review platform growth, AI metrics, operational activity, and marketplace trends."
                route="/admin/analytics-center"
              />
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
              <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
              <Text style={styles.logoutText}>Logout Admin</Text>
            </TouchableOpacity>
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
  const color = danger ? ui.red : warning ? ui.orange : success ? ui.green : accent ? ui.primary : ui.blue;

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

function AdminActionCard({
  icon,
  title,
  description,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={() => router.push(route as any)}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color={ui.primary} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>
    </TouchableOpacity>
  );
}

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="checkmark-done-outline" size={30} color={ui.green} />
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
  content: { paddingBottom: 90 },
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
  adminCard: {
    backgroundColor: ui.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  adminIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  adminLabel: { color: ui.muted, fontWeight: "900" },
  adminEmail: { color: ui.text, fontWeight: "900", marginTop: 3 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10 },
  heroCard: {
    backgroundColor: ui.primary,
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 22 },
  heroText: { color: "#EDE9FE", fontWeight: "700", marginTop: 5, lineHeight: 20 },
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
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  quickAction: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: ui.text, fontWeight: "900", fontSize: 13 },
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
  reviewCard: {
    backgroundColor: ui.soft,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 12,
  },
  reviewHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  reviewIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewTitle: { color: ui.text, fontWeight: "900", fontSize: 17, marginBottom: 4 },
  meta: { color: ui.muted, fontWeight: "700", marginTop: 4, lineHeight: 18, fontSize: 12 },
  reviewButtonRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  approveButton: {
    flex: 1,
    backgroundColor: ui.green,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: ui.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  reviewButtonText: { color: "#FFFFFF", fontWeight: "900" },
  disabled: { opacity: 0.55 },
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
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  actionCard: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionTitle: { color: ui.text, fontWeight: "900", fontSize: 16 },
  actionDescription: { color: ui.muted, fontWeight: "700", marginTop: 6, lineHeight: 20 },
  logoutButton: {
    backgroundColor: ui.red,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 30,
  },
  logoutText: { color: "#FFFFFF", fontWeight: "900" },
});