import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import {
  getAdminSession,
  getPendingVerificationRecords,
  getVerificationQueue,
  logoutAdmin,
  upsertVerificationRecord,
} from "../data/adminStore";

import { updateFarmerStore } from "../data/farmerStore";

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

    return (
      item.rejected === true ||
      status === "rejected" ||
      review === "rejected"
    );
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#14532D" />
        <Text style={styles.loadingText}>Loading Farm2Home Admin Dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.badge}>🛡️ Farm2Home Production Admin Portal</Text>
        <Text style={styles.title}>Admin Dashboard</Text>

        <Text style={styles.subtitle}>
          Monitor compliance approvals, Stripe onboarding, account access,
          marketplace operations, deliveries, freight activity, AI verification,
          and platform oversight.
        </Text>

        <View style={styles.adminInfoBox}>
          <Text style={styles.adminInfo}>Logged in as:</Text>
          <Text style={styles.adminEmail}>{adminEmail || "Administrator"}</Text>
        </View>
      </View>

      <View style={styles.productionBanner}>
        <Text style={styles.productionTitle}>🚀 Production Status</Text>
        <Text style={styles.productionText}>{productionStatus}</Text>
      </View>

      <Text style={styles.sectionTitle}>Platform Metrics</Text>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{pendingCount}</Text>
          <Text style={styles.metricLabel}>Pending Reviews</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{approvedCount}</Text>
          <Text style={styles.metricLabel}>Approved</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{rejectedCount}</Text>
          <Text style={styles.metricLabel}>Rejected</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{farmerCount}</Text>
          <Text style={styles.metricLabel}>Farmers</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{freightCount}</Text>
          <Text style={styles.metricLabel}>Freight</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>AI</Text>
          <Text style={styles.metricLabel}>Compliance</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Account Access</Text>

      <TouchableOpacity
        style={styles.accountsButton}
        onPress={() => router.push("/admin/accounts" as any)}
      >
        <Text style={styles.buttonTitle}>👥 Account Management</Text>
        <Text style={styles.buttonDescription}>
          View all current and previous accounts, usernames, passwords, active
          status, reset login credentials, approve farmers, unlock stores, and
          manually create accounts.
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Pending Farmer Approvals</Text>

      {pendingRecords.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No pending applications.</Text>
          <Text style={styles.emptyText}>Approved accounts can log in now.</Text>
        </View>
      ) : (
        pendingRecords.map((record) => {
          const id = getFarmerId(record);
          const actionLoading = actionLoadingId === id;

          return (
            <View key={id || getEmail(record)} style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>{getBusinessName(record)}</Text>
              <Text style={styles.reviewText}>Owner: {getOwnerName(record)}</Text>
              <Text style={styles.reviewText}>Email: {getEmail(record)}</Text>
              <Text style={styles.reviewText}>
                Status: {record.status || record.complianceStatus || "Pending"}
              </Text>

              <View style={styles.reviewButtonRow}>
                <TouchableOpacity
                  style={[styles.approveButton, actionLoading && styles.disabled]}
                  disabled={actionLoading}
                  onPress={() => approveRecord(record)}
                >
                  <Text style={styles.reviewButtonText}>
                    {actionLoading ? "Saving..." : "Approve & Unlock"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.rejectButton, actionLoading && styles.disabled]}
                  disabled={actionLoading}
                  onPress={() => rejectRecord(record)}
                >
                  <Text style={styles.reviewButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <Text style={styles.sectionTitle}>Compliance & Verification</Text>

      <TouchableOpacity
        style={styles.complianceButton}
        onPress={() => router.push("/admin/documents" as any)}
      >
        <Text style={styles.buttonTitle}>🛡️ AI Compliance Queue</Text>
        <Text style={styles.buttonDescription}>
          Review farmer and freight applications, Stripe onboarding status,
          uploaded documents, AI findings, and final approval.
        </Text>
        <Text style={styles.buttonCounter}>{pendingCount} pending review</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.documentsButton}
        onPress={() => router.push("/admin/compliance-review" as any)}
      >
        <Text style={styles.buttonTitle}>📄 Compliance Review Center</Text>
        <Text style={styles.buttonDescription}>
          Review verification findings, missing documents, and business
          validation checks.
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Marketplace Operations</Text>

      <TouchableOpacity
        style={styles.marketplaceButton}
        onPress={() => router.push("/customer/marketplace" as any)}
      >
        <Text style={styles.buttonTitle}>🛒 Open Marketplace</Text>
        <Text style={styles.buttonDescription}>
          View customer marketplace storefronts, products, pricing, and ordering
          flow.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.operationsButton}
        onPress={() => router.push("/admin/live-operations-center" as any)}
      >
        <Text style={styles.buttonTitle}>📡 Live Operations Center</Text>
        <Text style={styles.buttonDescription}>
          Monitor deliveries, drivers, routes, freight operations, and
          fulfillment activity.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.analyticsButton}
        onPress={() => router.push("/admin/analytics-center" as any)}
      >
        <Text style={styles.buttonTitle}>📊 Analytics Center</Text>
        <Text style={styles.buttonDescription}>
          Review platform growth, AI metrics, operational activity, and
          marketplace trends.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Logout Admin</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F7EF" },
  content: { padding: 20, paddingBottom: 60 },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#F5F7EF",
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  loadingText: {
    marginTop: 16,
    color: "#14532D",
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },

  heroCard: {
    backgroundColor: "#14532D",
    borderRadius: 30,
    padding: 24,
    marginTop: 18,
    marginBottom: 20,
  },
  badge: { color: "#DCFCE7", fontWeight: "900", marginBottom: 10, fontSize: 14 },
  title: { fontSize: 36, fontWeight: "900", color: "#FFFFFF" },
  subtitle: {
    color: "#E7F4DE",
    lineHeight: 24,
    marginTop: 10,
    fontWeight: "700",
  },
  adminInfoBox: {
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
  },
  adminInfo: { color: "#DCFCE7", fontWeight: "700", marginBottom: 4 },
  adminEmail: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },

  productionBanner: {
    backgroundColor: "#DCFCE7",
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
  },
  productionTitle: { color: "#14532D", fontWeight: "900", fontSize: 18 },
  productionText: { color: "#166534", marginTop: 6, fontWeight: "700" },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 14,
    marginTop: 4,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 26,
  },
  metricCard: {
    width: "30%",
    minWidth: 100,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#DDE7DB",
    alignItems: "center",
  },
  metricValue: { color: "#14532D", fontSize: 26, fontWeight: "900" },
  metricLabel: {
    color: "#64745E",
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },

  accountsButton: {
    backgroundColor: "#0F766E",
    borderRadius: 22,
    padding: 22,
    marginBottom: 24,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#DDE7DB",
    marginBottom: 20,
  },
  emptyTitle: { color: "#14532D", fontWeight: "900", fontSize: 18 },
  emptyText: { color: "#64745E", fontWeight: "700", marginTop: 6 },

  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#DDE7DB",
    marginBottom: 14,
  },
  reviewTitle: {
    color: "#14532D",
    fontWeight: "900",
    fontSize: 20,
    marginBottom: 8,
  },
  reviewText: {
    color: "#111827",
    fontWeight: "700",
    marginBottom: 5,
  },
  reviewButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  approveButton: {
    flex: 1,
    backgroundColor: "#047857",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#B91C1C",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  reviewButtonText: { color: "#FFFFFF", fontWeight: "900" },
  disabled: { opacity: 0.55 },

  complianceButton: {
    backgroundColor: "#7C3AED",
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
  },
  documentsButton: {
    backgroundColor: "#2563EB",
    borderRadius: 22,
    padding: 22,
    marginBottom: 24,
  },
  marketplaceButton: {
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
  },
  operationsButton: {
    backgroundColor: "#047857",
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
  },
  analyticsButton: {
    backgroundColor: "#B45309",
    borderRadius: 22,
    padding: 22,
    marginBottom: 28,
  },
  buttonTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 22,
    marginBottom: 8,
  },
  buttonDescription: {
    color: "#F3F4F6",
    lineHeight: 22,
    fontWeight: "700",
  },
  buttonCounter: { color: "#FFFFFF", marginTop: 10, fontWeight: "900" },

  logoutButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#111827",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  logoutText: { color: "#111827", fontWeight: "900", fontSize: 16 },
});