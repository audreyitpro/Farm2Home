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
import { router, useFocusEffect } from "expo-router";

import {
  getAdminSession,
  getPendingVerificationRecords,
  getVerificationQueue,
  logoutAdmin,
} from "../data/adminStore";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);

  const [adminEmail, setAdminEmail] = useState("");

  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  const [farmerCount, setFarmerCount] = useState(0);
  const [freightCount, setFreightCount] = useState(0);

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  async function loadDashboard() {
    try {
      setLoading(true);

      const session = await getAdminSession();

      if (!session) {
        router.replace("/admin/login" as any);
        return;
      }

      setAdminEmail(session.email || "");

      const queue = await getVerificationQueue();
      const pending = await getPendingVerificationRecords();

      const approved = queue.filter(
        (item) => item.status === "APPROVED"
      );

      const rejected = queue.filter(
        (item) => item.status === "REJECTED"
      );

      const farmers = queue.filter(
        (item) => item.accountType === "FARMER"
      );

      const freight = queue.filter(
        (item) => item.accountType === "FREIGHT_CARRIER"
      );

      setPendingCount(pending.length);
      setApprovedCount(approved.length);
      setRejectedCount(rejected.length);

      setFarmerCount(farmers.length);
      setFreightCount(freight.length);
    } catch (error) {
      console.log("Admin dashboard load error:", error);

      Alert.alert(
        "Dashboard Error",
        "Unable to load admin dashboard."
      );
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
    if (pendingCount > 0) {
      return "Manual reviews pending";
    }

    return "Operational";
  }, [pendingCount]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#14532D" />

        <Text style={styles.loadingText}>
          Loading Farm2Home Admin Dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshDashboard}
        />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.badge}>
          🛡️ Farm2Home Production Admin Portal
        </Text>

        <Text style={styles.title}>Admin Dashboard</Text>

        <Text style={styles.subtitle}>
          Monitor compliance approvals, Stripe onboarding,
          marketplace operations, deliveries, freight activity,
          AI verification, and platform oversight.
        </Text>

        <View style={styles.adminInfoBox}>
          <Text style={styles.adminInfo}>
            Logged in as:
          </Text>

          <Text style={styles.adminEmail}>
            {adminEmail || "Administrator"}
          </Text>
        </View>
      </View>

      <View style={styles.productionBanner}>
        <Text style={styles.productionTitle}>
          🚀 Production Status
        </Text>

        <Text style={styles.productionText}>
          {productionStatus}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Platform Metrics
      </Text>

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {pendingCount}
          </Text>

          <Text style={styles.metricLabel}>
            Pending Reviews
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {approvedCount}
          </Text>

          <Text style={styles.metricLabel}>
            Approved
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {rejectedCount}
          </Text>

          <Text style={styles.metricLabel}>
            Rejected
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {farmerCount}
          </Text>

          <Text style={styles.metricLabel}>
            Farmers
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            {freightCount}
          </Text>

          <Text style={styles.metricLabel}>
            Freight
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>
            AI
          </Text>

          <Text style={styles.metricLabel}>
            Compliance
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        Compliance & Verification
      </Text>

      <TouchableOpacity
        style={styles.complianceButton}
        onPress={() =>
          router.push("/admin/documents" as any)
        }
      >
        <Text style={styles.buttonTitle}>
          🛡️ AI Compliance Queue
        </Text>

        <Text style={styles.buttonDescription}>
          Review farmer and freight applications,
          Stripe onboarding status, uploaded
          documents, AI findings, and final approval.
        </Text>

        <Text style={styles.buttonCounter}>
          {pendingCount} pending review
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.documentsButton}
        onPress={() =>
          router.push("/admin/compliance-review" as any)
        }
      >
        <Text style={styles.buttonTitle}>
          📄 Compliance Review Center
        </Text>

        <Text style={styles.buttonDescription}>
          Review verification findings, missing
          documents, and business validation checks.
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>
        Marketplace Operations
      </Text>

      <TouchableOpacity
        style={styles.marketplaceButton}
        onPress={() =>
          router.push("/customer/marketplace" as any)
        }
      >
        <Text style={styles.buttonTitle}>
          🛒 Open Marketplace
        </Text>

        <Text style={styles.buttonDescription}>
          View customer marketplace storefronts,
          products, pricing, and ordering flow.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.operationsButton}
        onPress={() =>
          router.push(
            "/admin/live-operations-center" as any
          )
        }
      >
        <Text style={styles.buttonTitle}>
          📡 Live Operations Center
        </Text>

        <Text style={styles.buttonDescription}>
          Monitor deliveries, drivers, routes,
          freight operations, and fulfillment activity.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.analyticsButton}
        onPress={() =>
          router.push("/admin/analytics-center" as any)
        }
      >
        <Text style={styles.buttonTitle}>
          📊 Analytics Center
        </Text>

        <Text style={styles.buttonDescription}>
          Review platform growth, AI metrics,
          operational activity, and marketplace trends.
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>
        AI Monitoring Systems
      </Text>

      <View style={styles.aiGrid}>
        <View style={styles.aiCard}>
          <Text style={styles.aiValue}>24/7</Text>

          <Text style={styles.aiLabel}>
            AI Monitoring
          </Text>
        </View>

        <View style={styles.aiCard}>
          <Text style={styles.aiValue}>US</Text>

          <Text style={styles.aiLabel}>
            State Validation
          </Text>
        </View>

        <View style={styles.aiCard}>
          <Text style={styles.aiValue}>LIVE</Text>

          <Text style={styles.aiLabel}>
            Stripe Sync
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={signOut}
      >
        <Text style={styles.logoutText}>
          Logout Admin
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F5F7EF",
  },

  content: {
    padding: 20,
    paddingBottom: 60,
  },

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

  badge: {
    color: "#DCFCE7",
    fontWeight: "900",
    marginBottom: 10,
    fontSize: 14,
  },

  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
  },

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

  adminInfo: {
    color: "#DCFCE7",
    fontWeight: "700",
    marginBottom: 4,
  },

  adminEmail: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  productionBanner: {
    backgroundColor: "#DCFCE7",
    borderRadius: 22,
    padding: 18,
    marginBottom: 24,
  },

  productionTitle: {
    color: "#14532D",
    fontWeight: "900",
    fontSize: 18,
  },

  productionText: {
    color: "#166534",
    marginTop: 6,
    fontWeight: "700",
  },

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

  metricValue: {
    color: "#14532D",
    fontSize: 26,
    fontWeight: "900",
  },

  metricLabel: {
    color: "#64745E",
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },

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

  buttonCounter: {
    color: "#FFFFFF",
    marginTop: 10,
    fontWeight: "900",
  },

  aiGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 30,
  },

  aiCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#DDE7DB",
    alignItems: "center",
  },

  aiValue: {
    color: "#14532D",
    fontSize: 22,
    fontWeight: "900",
  },

  aiLabel: {
    color: "#64745E",
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },

  logoutButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#111827",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },

  logoutText: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
  },
});