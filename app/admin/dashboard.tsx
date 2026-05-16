import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

export default function AdminDashboard() {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.badge}>🛡️ Farm2Home Admin Portal</Text>

        <Text style={styles.title}>Admin Dashboard</Text>

        <Text style={styles.subtitle}>
          Manage compliance approvals, marketplace operations, documents,
          farmers, deliveries, and platform oversight.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Compliance & Verification</Text>

      <TouchableOpacity
        style={styles.complianceButton}
        onPress={() => router.push("/admin/compliance-review" as any)}
      >
        <Text style={styles.buttonTitle}>🛡️ Compliance Review</Text>

        <Text style={styles.buttonDescription}>
          Review farmers requiring manual approval or additional verification.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.documentsButton}
        onPress={() => router.push("/admin/documents" as any)}
      >
        <Text style={styles.buttonTitle}>📄 Document Review</Text>

        <Text style={styles.buttonDescription}>
          Review uploaded business, insurance, permit, and compliance documents.
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Marketplace Operations</Text>

      <TouchableOpacity
        style={styles.marketplaceButton}
        onPress={() => router.push("/customer/marketplace" as any)}
      >
        <Text style={styles.buttonTitle}>🛒 Open Marketplace</Text>

        <Text style={styles.buttonDescription}>
          View the customer marketplace experience and storefront listings.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.operationsButton}
        onPress={() => router.push("/admin/live-operations-center" as any)}
      >
        <Text style={styles.buttonTitle}>📡 Live Operations</Text>

        <Text style={styles.buttonDescription}>
          Monitor platform activity, deliveries, drivers, and fulfillment.
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Admin Tools</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>AI</Text>
          <Text style={styles.statLabel}>Compliance</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>US</Text>
          <Text style={styles.statLabel}>State Checks</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statValue}>24/7</Text>
          <Text style={styles.statLabel}>Monitoring</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => router.replace("/admin/login" as any)}
      >
        <Text style={styles.logoutText}>Back to Admin Login</Text>
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
    paddingBottom: 50,
  },

  heroCard: {
    backgroundColor: "#14532D",
    borderRadius: 30,
    padding: 24,
    marginTop: 18,
    marginBottom: 24,
  },

  badge: {
    color: "#DCFCE7",
    fontWeight: "900",
    marginBottom: 10,
    fontSize: 14,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  subtitle: {
    color: "#E7F4DE",
    lineHeight: 24,
    marginTop: 10,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 14,
    marginTop: 6,
  },

  complianceButton: {
    backgroundColor: "#7C3AED",
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },

  documentsButton: {
    backgroundColor: "#2563EB",
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
  },

  marketplaceButton: {
    backgroundColor: "#111827",
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },

  operationsButton: {
    backgroundColor: "#047857",
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
  },

  buttonTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 20,
    marginBottom: 6,
  },

  buttonDescription: {
    color: "#F3F4F6",
    lineHeight: 22,
    fontWeight: "700",
  },

  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDE7DB",
    alignItems: "center",
  },

  statValue: {
    color: "#14532D",
    fontSize: 24,
    fontWeight: "900",
  },

  statLabel: {
    color: "#64745E",
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center",
  },

  logoutButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#111827",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 4,
  },

  logoutText: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
  },
});