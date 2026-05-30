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
import freightTheme from "../styles/freightTheme";

type VerificationRecord = any;

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

    return (
      item.approved === true ||
      status === "approved" ||
      status === "approved_verification" ||
      review === "approved"
    );
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
    return (
      record?.businessName ||
      record?.farmName ||
      record?.farm_name ||
      "Farm2Home Farm"
    );
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
      ...current.filter((item: any) => {
        const itemId = getFarmerId(item);
        const itemEmail = getEmail(item);

        return itemId !== id && itemEmail !== email;
      }),
    ];

    await writeArray(key, next);
  }

  async function updateQueueRecord(updatedRecord: any) {
    for (const key of QUEUE_KEYS) {
      const current = await readArray(key);

      const next = current.map((item: any) => {
        const sameId = getFarmerId(item) === getFarmerId(updatedRecord);
        const sameEmail = getEmail(item) === getEmail(updatedRecord);

        if (sameId || sameEmail) {
          return {
            ...item,
            ...updatedRecord,
          };
        }

        return item;
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
        headers: {
          "Content-Type": "application/json",
        },
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
      console.log("Approve farmer error:", error);
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
      console.log("Reject farmer error:", error);
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
      setFarmerCount(
        finalQueue.filter((item) => getAccountType(item) === "FARMER").length
      );
      setFreightCount(
        finalQueue.filter((item) => getAccountType(item) === "FREIGHT_CARRIER")
          .length
      );
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
      router.replace("/admin/login" as any);
    } catch (error) {
      console.log("Logout error:", error);
      router.replace("/admin/login" as any);
    }
  }

  const productionStatus = useMemo(() => {
    if (pendingCount > 0) return "Manual reviews pending";
    return "Operational";
  }, [pendingCount]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading Farm2Home Admin Dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.badge}>Farm2Home Production Admin Portal</Text>
              <Text style={styles.title}>Admin Dashboard</Text>

              <Text style={styles.subtitle}>
                Monitor compliance approvals, Stripe onboarding, account access,
                marketplace operations, deliveries, freight activity, AI
                verification, and platform oversight.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.adminInfoBox}>
            <Text style={styles.adminInfo}>Logged in as</Text>
            <Text style={styles.adminEmail}>{adminEmail || "Administrator"}</Text>
          </View>
        </View>

        <View style={styles.productionBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productionTitle}>Production Status</Text>
            <Text style={styles.productionText}>{productionStatus}</Text>
          </View>

          <View style={styles.productionIcon}>
            <Ionicons
              name={pendingCount > 0 ? "alert-circle-outline" : "checkmark-done-outline"}
              size={28}
              color="#BBF7D0"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Platform Metrics</Text>

        <View style={styles.metricsGrid}>
          <MetricCard icon="time-outline" value={String(pendingCount)} label="Pending Reviews" accent />
          <MetricCard icon="checkmark-done-outline" value={String(approvedCount)} label="Approved" accent />
          <MetricCard icon="close-circle-outline" value={String(rejectedCount)} label="Rejected" />
          <MetricCard icon="leaf-outline" value={String(farmerCount)} label="Farmers" />
          <MetricCard icon="trail-sign-outline" value={String(freightCount)} label="Freight" />
          <MetricCard icon="sparkles-outline" value="AI" label="Compliance" />
        </View>

        <Text style={styles.sectionTitle}>Account Access</Text>

        <AdminActionCard
          icon="people-outline"
          title="Account Management"
          description="View all current and previous accounts, usernames, passwords, active status, reset login credentials, approve farmers, unlock stores, and manually create accounts."
          color="#0F766E"
          onPress={() => router.push("/admin/accounts" as any)}
        />

        <Text style={styles.sectionTitle}>Pending Farmer Approvals</Text>

        {pendingRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-done-outline" size={34} color="#10B981" />
            <Text style={styles.emptyTitle}>No pending applications.</Text>
            <Text style={styles.emptyText}>Approved accounts can log in now.</Text>
          </View>
        ) : (
          pendingRecords.map((record) => {
            const id = getFarmerId(record);
            const actionLoading = actionLoadingId === id;

            return (
              <View key={id || getEmail(record)} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewTitle}>{getBusinessName(record)}</Text>
                    <Text style={styles.reviewText}>Owner: {getOwnerName(record)}</Text>
                    <Text style={styles.reviewText}>Email: {getEmail(record)}</Text>
                    <Text style={styles.reviewText}>
                      Status: {record.status || record.complianceStatus || "Pending"}
                    </Text>
                  </View>

                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewBadgeText}>Pending</Text>
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

        <Text style={styles.sectionTitle}>Compliance & Verification</Text>

        <AdminActionCard
          icon="shield-checkmark-outline"
          title="AI Compliance Queue"
          description="Review farmer and freight applications, Stripe onboarding status, uploaded documents, AI findings, and final approval."
          counter={`${pendingCount} pending review`}
          color="#7C3AED"
          onPress={() => router.push("/admin/documents" as any)}
        />

        <AdminActionCard
          icon="document-text-outline"
          title="Compliance Review Center"
          description="Review verification findings, missing documents, and business validation checks."
          color="#2563EB"
          onPress={() => router.push("/admin/compliance-review" as any)}
        />

        <Text style={styles.sectionTitle}>Marketplace Operations</Text>

        <AdminActionCard
          icon="storefront-outline"
          title="Open Marketplace"
          description="View customer marketplace storefronts, products, pricing, and ordering flow."
          color="#111827"
          onPress={() => router.push("/customer/marketplace" as any)}
        />

        <AdminActionCard
          icon="radio-outline"
          title="Live Operations Center"
          description="Monitor deliveries, drivers, routes, freight operations, and fulfillment activity."
          color="#047857"
          onPress={() => router.push("/admin/live-operations-center" as any)}
        />

        <AdminActionCard
          icon="analytics-outline"
          title="Analytics Center"
          description="Review platform growth, AI metrics, operational activity, and marketplace trends."
          color="#B45309"
          onPress={() => router.push("/admin/analytics-center" as any)}
        />

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout Admin</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({
  icon,
  value,
  label,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.metricCard, accent && styles.metricCardAccent]}>
      <Ionicons
        name={icon}
        size={22}
        color={accent ? "#BBF7D0" : freightTheme.colors.primary}
      />
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>
        {value}
      </Text>
      <Text style={[styles.metricLabel, accent && styles.metricLabelAccent]}>
        {label}
      </Text>
    </View>
  );
}

function AdminActionCard({
  icon,
  title,
  description,
  counter,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  counter?: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.actionHeader}>
        <View style={styles.actionIcon}>
          <Ionicons name={icon} size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.buttonTitle}>{title}</Text>
      </View>

      <Text style={styles.buttonDescription}>{description}</Text>

      {!!counter && <Text style={styles.buttonCounter}>{counter}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  page: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 90,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  loadingText: {
    marginTop: 16,
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },
  heroCard: {
    backgroundColor: "#020617",
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  subtitle: {
    color: "#CBD5E1",
    lineHeight: 24,
    marginTop: 10,
    fontWeight: "700",
  },
  adminInfoBox: {
    marginTop: 18,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
  },
  adminInfo: {
    color: "#94A3B8",
    fontWeight: "700",
    marginBottom: 4,
  },
  adminEmail: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  productionBanner: {
    backgroundColor: "#064E3B",
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  productionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#052E2B",
    alignItems: "center",
    justifyContent: "center",
  },
  productionTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 20,
  },
  productionText: {
    color: "#BBF7D0",
    marginTop: 6,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: freightTheme.colors.text,
    marginBottom: 14,
    marginTop: 4,
    paddingHorizontal: 18,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 24,
  },
  metricCard: {
    width: "31%",
    minWidth: 100,
    backgroundColor: freightTheme.colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  metricCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },
  metricValue: {
    color: freightTheme.colors.primary,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 8,
  },
  metricValueAccent: {
    color: "#FFFFFF",
  },
  metricLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
    fontSize: 12,
  },
  metricLabelAccent: {
    color: "#BBF7D0",
  },
  actionCard: {
    borderRadius: 22,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 21,
    flex: 1,
  },
  buttonDescription: {
    color: "#F3F4F6",
    lineHeight: 22,
    fontWeight: "700",
  },
  buttonCounter: {
    color: "#FFFFFF",
    marginTop: 10,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    marginHorizontal: 18,
    marginBottom: 20,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 20,
    marginTop: 10,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },
  reviewCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  reviewHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  reviewTitle: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 20,
    marginBottom: 8,
  },
  reviewText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginBottom: 5,
  },
  reviewBadge: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  reviewBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  reviewButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  approveButton: {
    flex: 1,
    backgroundColor: "#047857",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#B91C1C",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  reviewButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.55,
  },
  logoutButton: {
    backgroundColor: "#DC2626",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 30,
    flexDirection: "row",
    gap: 8,
  },
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});